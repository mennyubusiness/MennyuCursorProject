/**
 * Derived operational incidents for admin triage — supplements attention queue + issue models.
 */
import "server-only";

import { VendorFulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getAttentionItems,
  type AdminAttentionItem,
  type AdminAttentionSeverity,
} from "@/lib/admin-attention";
import {
  DERIVED_INCIDENT_SCAN_LIMIT,
  INCIDENT_LOOKBACK_DAYS,
  ORDER_PENDING_PAYMENT_STUCK_MINUTES,
  VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES,
  VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES,
  VENDOR_READY_STUCK_MINUTES,
} from "@/lib/admin-health-thresholds";
import {
  detectPaymentHealthIssues,
  paymentHealthIssueLabel,
} from "@/services/admin-payment-health.service";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";

import type {
  AdminIncidentEntityType,
  AdminIncidentRow,
  AdminIncidentSeverity,
  AdminIncidentType,
} from "@/lib/admin-incident-types";

export type AdminIncidentSearchParams = {
  severity?: AdminIncidentSeverity | "all";
  type?: AdminIncidentType | "all";
  entity?: AdminIncidentEntityType | "all";
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

const TERMINAL_ORDER = new Set(["completed", "cancelled", "failed"]);
const TERMINAL_FULFILLMENT = new Set(["completed", "cancelled"]);
const ACTIVE_FULFILLMENT = new Set(["pending", "accepted", "preparing", "ready"]);

function mapAttentionSeverity(sev: AdminAttentionSeverity): AdminIncidentSeverity {
  if (sev === "critical") return "critical";
  if (sev === "high") return "warning";
  return "info";
}

function mapAttentionType(reason: AdminAttentionItem["reason"]): AdminIncidentType {
  switch (reason) {
    case "routing_failed":
      return "routing_failed";
    case "routing_stuck":
      return "routing_stuck";
    case "fulfillment_stuck":
      return "fulfillment_stuck";
    case "open_issue":
    case "customer_reported_issue":
      return "open_issue";
    case "refund_failed":
      return "refund_failed";
    case "refund_review_required":
      return "refund_review";
    case "vendor_clawback_failed":
    case "vendor_clawback_pending":
    case "vendor_clawback_missing":
    case "legacy_clawback_review":
      return "vendor_clawback";
    default:
      return "other";
  }
}

function attentionToIncident(item: AdminAttentionItem): AdminIncidentRow {
  const type = mapAttentionType(item.reason);
  const entityType: AdminIncidentEntityType = item.vendorOrderId
    ? "vendor_order"
    : item.issueId
      ? "issue"
      : "order";

  return {
    id: `attention:${item.id}`,
    severity: mapAttentionSeverity(item.severity),
    type,
    entityType,
    entityId: item.vendorOrderId ?? item.issueId ?? item.orderId,
    entityLabel: item.orderId.slice(-8),
    description: item.reasonLabel,
    reasonDetail: `${item.reason} · ${item.ageMinutes}m old · ${item.currentStatus}`,
    detectedAt: new Date(Date.now() - item.ageMinutes * 60_000),
    updatedAt: null,
    currentState: item.currentStatus,
    recommendedAction: item.recommendedAction.replace(/_/g, " "),
    adminHref: item.primaryEntityHref,
    status: "open",
  };
}

function paymentIssueToIncident(issue: Awaited<ReturnType<typeof detectPaymentHealthIssues>>[number]): AdminIncidentRow {
  const severity: AdminIncidentSeverity =
    issue.issueType === "payment_succeeded_order_failed" ||
    issue.issueType === "order_paid_payment_missing"
      ? "critical"
      : "warning";

  return {
    id: issue.id,
    severity,
    type: "payment",
    entityType: issue.paymentId ? "payment" : "order",
    entityId: issue.paymentId ?? issue.orderId ?? issue.id,
    entityLabel: issue.orderId?.slice(-8) ?? issue.paymentId?.slice(-8) ?? "—",
    description: paymentHealthIssueLabel(issue.issueType),
    reasonDetail: issue.description,
    detectedAt: issue.detectedAt,
    updatedAt: null,
    currentState: issue.status,
    recommendedAction: "Review payment on order detail; re-run validation if needed",
    adminHref: issue.adminHref,
    status: "open",
  };
}

export async function detectAdminIncidents(limit = 500): Promise<AdminIncidentRow[]> {
  const now = Date.now();
  const since = new Date(now - INCIDENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const byId = new Map<string, AdminIncidentRow>();

  const [attentionItems, paymentIssues, stuckOrders, mismatches, podIncidents, vendorIncidents, smsFailures, webhookFailures] =
    await Promise.all([
      getAttentionItems(),
      detectPaymentHealthIssues(50),
      detectStuckOrderIncidents(since),
      detectOrderStatusMismatchIncidents(since),
      detectPodNoVendorIncidents(),
      detectVendorNoItemsIncidents(),
      detectSmsFailureIncidents(since),
      detectWebhookFailureIncidents(since),
    ]);

  for (const item of attentionItems) {
    byId.set(`attention:${item.id}`, attentionToIncident(item));
  }
  for (const issue of paymentIssues) {
    if (!byId.has(issue.id)) byId.set(issue.id, paymentIssueToIncident(issue));
  }
  for (const row of [
    ...stuckOrders,
    ...mismatches,
    ...podIncidents,
    ...vendorIncidents,
    ...smsFailures,
    ...webhookFailures,
  ]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const sorted = [...byId.values()].sort(
    (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
  );
  return sorted.slice(0, limit);
}

export async function searchAdminIncidents(params: AdminIncidentSearchParams): Promise<{
  rows: AdminIncidentRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const all = await detectAdminIncidents(1000);
  let filtered = all;

  if (params.severity && params.severity !== "all") {
    filtered = filtered.filter((r) => r.severity === params.severity);
  }
  if (params.type && params.type !== "all") {
    filtered = filtered.filter((r) => r.type === params.type);
  }
  if (params.entity && params.entity !== "all") {
    filtered = filtered.filter((r) => r.entityType === params.entity);
  }
  if (params.from) {
    filtered = filtered.filter((r) => r.detectedAt >= params.from!);
  }
  if (params.to) {
    filtered = filtered.filter((r) => r.detectedAt <= params.to!);
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  return {
    rows: filtered.slice(skip, skip + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function detectStuckOrderIncidents(since: Date): Promise<AdminIncidentRow[]> {
  const now = Date.now();
  const rows: AdminIncidentRow[] = [];

  const pendingPaymentCutoff = new Date(now - ORDER_PENDING_PAYMENT_STUCK_MINUTES * 60_000);
  const fulfillmentPendingCutoff = new Date(now - VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES * 60_000);
  const acceptedPreparingCutoff = new Date(now - VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES * 60_000);
  const readyCutoff = new Date(now - VENDOR_READY_STUCK_MINUTES * 60_000);

  const [pendingOrders, stuckVendorOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: pendingPaymentCutoff, gte: since },
      },
      select: { id: true, createdAt: true, status: true },
      take: DERIVED_INCIDENT_SCAN_LIMIT,
    }),
    prisma.vendorOrder.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          {
            fulfillmentStatus: VendorFulfillmentStatus.pending,
            order: { status: { not: "pending_payment" } },
            createdAt: { lt: fulfillmentPendingCutoff },
          },
          {
            fulfillmentStatus: { in: ["accepted", "preparing"] },
            updatedAt: { lt: acceptedPreparingCutoff },
          },
          {
            fulfillmentStatus: VendorFulfillmentStatus.ready,
            updatedAt: { lt: readyCutoff },
          },
        ],
      },
      select: {
        id: true,
        orderId: true,
        routingStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      take: DERIVED_INCIDENT_SCAN_LIMIT,
    }),
  ]);

  for (const order of pendingOrders) {
    rows.push({
      id: `stuck_order:pending_payment:${order.id}`,
      severity: "warning",
      type: "stuck_order",
      entityType: "order",
      entityId: order.id,
      entityLabel: order.id.slice(-8),
      description: "Order stuck in pending payment",
      reasonDetail: `pending_payment since ${order.createdAt.toISOString()} (>${ORDER_PENDING_PAYMENT_STUCK_MINUTES}m)`,
      detectedAt: order.createdAt,
      updatedAt: null,
      currentState: order.status,
      recommendedAction: "Inspect checkout; confirm PaymentIntent state on order detail",
      adminHref: `/admin/orders/${order.id}`,
      status: "open",
    });
  }

  for (const vo of stuckVendorOrders) {
    let reason = "Vendor order stuck";
    if (vo.fulfillmentStatus === "pending") {
      reason = `Fulfillment pending >${VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES}m after payment`;
    } else if (vo.fulfillmentStatus === "accepted" || vo.fulfillmentStatus === "preparing") {
      reason = `${vo.fulfillmentStatus} >${VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES}m`;
    } else if (vo.fulfillmentStatus === "ready") {
      reason = `Ready >${VENDOR_READY_STUCK_MINUTES}m`;
    }

    rows.push({
      id: `stuck_order:vo:${vo.id}:${vo.fulfillmentStatus}`,
      severity: vo.fulfillmentStatus === "ready" ? "warning" : "critical",
      type: "stuck_order",
      entityType: "vendor_order",
      entityId: vo.id,
      entityLabel: vo.orderId.slice(-8),
      description: reason,
      reasonDetail: `routing=${vo.routingStatus} fulfillment=${vo.fulfillmentStatus}`,
      detectedAt: vo.createdAt,
      updatedAt: vo.updatedAt,
      currentState: `${vo.routingStatus}/${vo.fulfillmentStatus}`,
      recommendedAction: "Open order detail for routing recovery or manual recovery",
      adminHref: `/admin/orders/${vo.orderId}`,
      status: "open",
    });
  }

  return rows;
}

async function detectOrderStatusMismatchIncidents(since: Date): Promise<AdminIncidentRow[]> {
  const rows: AdminIncidentRow[] = [];
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: "pending_payment" } },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      vendorOrders: { select: { id: true, fulfillmentStatus: true } },
    },
    take: DERIVED_INCIDENT_SCAN_LIMIT,
  });

  for (const order of orders) {
    if (order.vendorOrders.length === 0) continue;
    const allTerminal = order.vendorOrders.every((vo) => TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus));
    const anyActive = order.vendorOrders.some((vo) => ACTIVE_FULFILLMENT.has(vo.fulfillmentStatus));

    if (TERMINAL_ORDER.has(order.status) && anyActive) {
      rows.push({
        id: `order_status_mismatch:terminal_parent:${order.id}`,
        severity: "critical",
        type: "order_status_mismatch",
        entityType: "order",
        entityId: order.id,
        entityLabel: order.id.slice(-8),
        description: "Parent order terminal while vendor orders still active",
        reasonDetail: `order=${order.status}`,
        detectedAt: order.updatedAt,
        updatedAt: order.updatedAt,
        currentState: order.status,
        recommendedAction: "Reconcile parent order status with vendor orders on order detail",
        adminHref: `/admin/orders/${order.id}`,
        status: "open",
      });
    }

    if (!TERMINAL_ORDER.has(order.status) && allTerminal) {
      rows.push({
        id: `order_status_mismatch:active_parent:${order.id}`,
        severity: "warning",
        type: "order_status_mismatch",
        entityType: "order",
        entityId: order.id,
        entityLabel: order.id.slice(-8),
        description: "Parent order active while all vendor orders are terminal",
        reasonDetail: `order=${order.status}`,
        detectedAt: order.updatedAt,
        updatedAt: order.updatedAt,
        currentState: order.status,
        recommendedAction: "Confirm order completion state on order detail",
        adminHref: `/admin/orders/${order.id}`,
        status: "open",
      });
    }
  }

  return rows;
}

async function detectPodNoVendorIncidents(): Promise<AdminIncidentRow[]> {
  const pods = await prisma.pod.findMany({
    where: { isActive: true, mennyuOrdersPaused: false },
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
      vendors: {
        where: { isActive: true },
        select: { vendor: { select: { isActive: true, mennyuOrdersPaused: true } } },
      },
    },
    take: DERIVED_INCIDENT_SCAN_LIMIT,
  });

  return pods
    .filter(
      (pod) =>
        !pod.vendors.some((pv) => pv.vendor.isActive && !pv.vendor.mennyuOrdersPaused)
    )
    .map((pod) => ({
      id: `pod_no_vendors:${pod.id}`,
      severity: "warning" as const,
      type: "pod_no_vendors" as const,
      entityType: "pod" as const,
      entityId: pod.id,
      entityLabel: pod.name,
      description: "Public pod has zero orderable vendors",
      reasonDetail: "Pod is visible and not paused but no active, unpaused vendors",
      detectedAt: pod.updatedAt,
      updatedAt: pod.updatedAt,
      currentState: "public / no orderable vendors",
      recommendedAction: "Attach vendors or pause/hide pod on pod admin page",
      adminHref: `/admin/pods/${pod.id}`,
      status: "open" as const,
    }));
}

async function detectVendorNoItemsIncidents(): Promise<AdminIncidentRow[]> {
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true, mennyuOrdersPaused: false },
    select: { id: true, name: true, slug: true, updatedAt: true },
    take: DERIVED_INCIDENT_SCAN_LIMIT,
  });
  if (vendors.length === 0) return [];

  const readiness = await loadVendorMenuReadinessSummaries(vendors.map((v) => v.id));
  return vendors
    .filter((v) => {
      const summary = readiness.get(v.id);
      return (
        summary &&
        (!summary.hasOperationalItems || !summary.hasAvailableOperationalItems)
      );
    })
    .map((v) => ({
      id: `vendor_no_items:${v.id}`,
      severity: "warning" as const,
      type: "vendor_no_items" as const,
      entityType: "vendor" as const,
      entityId: v.id,
      entityLabel: v.name,
      description: "Vendor orderable but no visible menu items",
      reasonDetail: "Operational menu exists but no available items",
      detectedAt: v.updatedAt,
      updatedAt: v.updatedAt,
      currentState: "public / no available items",
      recommendedAction: "Review menu availability or pause vendor",
      adminHref: `/admin/vendors/${v.id}`,
      status: "open" as const,
    }));
}

async function detectSmsFailureIncidents(since: Date): Promise<AdminIncidentRow[]> {
  const logs = await prisma.smsMessageLog.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["failed", "undelivered"] },
    },
    select: {
      id: true,
      orderId: true,
      eventType: true,
      status: true,
      errorCode: true,
      failureMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return logs.map((log) => ({
    id: `sms_failed:${log.id}`,
    severity: "warning" as const,
    type: "sms_failed" as const,
    entityType: "notification" as const,
    entityId: log.id,
    entityLabel: log.eventType,
    description: "SMS delivery failed",
    reasonDetail: [log.errorCode, log.failureMessage].filter(Boolean).join(" · ") || log.status,
    detectedAt: log.createdAt,
    updatedAt: null,
    currentState: log.status,
    recommendedAction: "Review notification log; resend only via safe transactional helper with consent",
    adminHref: log.orderId
      ? `/admin/orders/${log.orderId}`
      : `/admin/notifications?status=failed`,
    status: "open" as const,
  }));
}

async function detectWebhookFailureIncidents(since: Date): Promise<AdminIncidentRow[]> {
  const events = await prisma.webhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ processed: false }, { errorMessage: { not: null } }],
    },
    select: {
      id: true,
      provider: true,
      eventId: true,
      errorMessage: true,
      createdAt: true,
      processed: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return events.map((ev) => ({
    id: `webhook_failed:${ev.id}`,
    severity: "warning" as const,
    type: "webhook_failed" as const,
    entityType: "webhook" as const,
    entityId: ev.id,
    entityLabel: ev.provider,
    description: "Webhook processing failed",
    reasonDetail: ev.errorMessage ?? (ev.processed ? "processed with error" : "not processed"),
    detectedAt: ev.createdAt,
    updatedAt: null,
    currentState: ev.processed ? "processed_error" : "unprocessed",
    recommendedAction: "Inspect webhook log; replay not configured in admin",
    adminHref: `/admin/webhooks?status=failed`,
    status: "open" as const,
  }));
}
