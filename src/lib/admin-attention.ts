/**
 * Admin Needs Attention: single source of truth for what needs attention.
 * Used by Exceptions page, Orders "Needs attention only" filter, and dashboard counts.
 * No UI or API changes in this module; behavior aligned with current exception + issue logic.
 */

import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DELIVERECT_RECONCILIATION_STALE_MINUTES,
  ROUTING_STUCK_THRESHOLD_MINUTES,
} from "@/lib/admin-exceptions";
import { describeDeliverectReconciliationForAdmin } from "@/lib/deliverect-reconciliation-helpers";
import { getExceptionUrgency } from "@/lib/admin-urgency";
import { getOrderIdsWithOpenIssues } from "@/services/issues.service";
import { ageMinutes as ageMinutesUtil } from "@/lib/date-utils";

// ---- Types (normalized attention item) ----

export type AdminAttentionScope = "order" | "vendor_order" | "issue";

export type AdminAttentionReason =
  | "routing_failed"
  | "routing_stuck"
  | "deliverect_reconciliation_overdue"
  | "fulfillment_stuck"
  | "open_issue"
  | "refund_failed"
  | "manual_recovery_required"
  | "financial_resolution"
  | "unknown_attention_needed";

export type AdminAttentionBucket =
  | "recoverable"
  | "financial_resolution"
  | "investigation";

export type AdminRecommendedAction =
  | "retry_routing"
  | "mark_manually_received"
  | "cancel_vendor_order"
  | "resolve_issue"
  | "view_order"
  | "investigate";

export type AdminAttentionSeverity = "critical" | "high" | "medium" | "low";

export interface AdminAttentionItem {
  id: string;
  scope: AdminAttentionScope;
  reason: AdminAttentionReason;
  bucket: AdminAttentionBucket;
  severity: AdminAttentionSeverity;
  ageMinutes: number;
  recommendedAction: AdminRecommendedAction;
  reasonLabel: string;
  currentStatus: string;

  orderId: string;
  vendorOrderId?: string | null;
  issueId?: string | null;
  issueType?: string | null;

  /** Direct link for admin queue rows (e.g. /admin/orders/{orderId}). */
  primaryEntityHref: string;

  order?: { id: string; customerPhone: string | null; pod?: { name: string } | null };
  vendor?: { name: string };
  deliverectLastError?: string | null;
  deliverectAttempts?: number | null;
  deliverectSubmittedAt?: Date | null;
  /** Longer plain-English diagnostic for Deliverect reconciliation cases. */
  deliverectDiagnostic?: string | null;
}

// ---- Constants (aligned with exceptions page and orders filter) ----

const ROUTING_STUCK_MS = ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000;
const DELIVERECT_RECONCILIATION_STALE_MS = DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TAKE_VO = 200;
const TAKE_OPEN_ISSUE_ORDERS = 500;
const TAKE_REFUND_FAILED = 100;

const VO_INCLUDE = {
  order: { select: { id: true, customerPhone: true, pod: { select: { name: true } } } },
  vendor: { select: { name: true } },
} as const;

// ---- Helpers ----

function urgencyToSeverity(urgency: "new" | "stuck" | "critical"): AdminAttentionSeverity {
  switch (urgency) {
    case "new":
      return "low";
    case "stuck":
      return "medium";
    case "critical":
      return "critical";
    default:
      return "medium";
  }
}

function reasonToBucket(reason: AdminAttentionReason): AdminAttentionBucket {
  switch (reason) {
    case "routing_failed":
    case "routing_stuck":
    case "deliverect_reconciliation_overdue":
    case "fulfillment_stuck":
    case "manual_recovery_required":
      return "recoverable";
    case "refund_failed":
    case "financial_resolution":
      return "financial_resolution";
    default:
      return "investigation";
  }
}

function reasonToRecommendedAction(
  reason: AdminAttentionReason,
  fulfillmentStatus?: string
): AdminRecommendedAction {
  switch (reason) {
    case "routing_failed":
    case "routing_stuck":
    case "deliverect_reconciliation_overdue":
    case "manual_recovery_required":
      return fulfillmentStatus === "pending" ? "retry_routing" : "view_order";
    case "fulfillment_stuck":
      return "view_order";
    case "open_issue":
      return "resolve_issue";
    case "refund_failed":
      return "view_order";
    case "financial_resolution":
      return "view_order";
    default:
      return "investigate";
  }
}

function reasonToLabel(
  reason: AdminAttentionReason,
  vo?: { deliverectLastError?: string | null } | { failureCode?: string | null; failureMessage?: string | null }
): string {
  switch (reason) {
    case "routing_failed":
      return vo && "deliverectLastError" in vo
        ? (vo.deliverectLastError?.slice(0, 80) ?? "Routing failed")
        : "Routing failed";
    case "routing_stuck":
      return `Routing still pending after ${ROUTING_STUCK_THRESHOLD_MINUTES}+ min`;
    case "deliverect_reconciliation_overdue":
      return `Submitted to Deliverect, but no POS webhook confirmation after ${DELIVERECT_RECONCILIATION_STALE_MINUTES}+ min`;
    case "fulfillment_stuck":
      return "Fulfillment in early state for too long";
    case "open_issue":
      return "Order or vendor order has an open issue";
    case "refund_failed":
      return vo && "failureMessage" in vo && vo.failureMessage
        ? `Refund failed: ${vo.failureMessage.slice(0, 80)}`
        : "Refund failed — needs manual resolution";
    case "manual_recovery_required":
      return "Manual recovery required";
    case "financial_resolution":
      return "Financial resolution needed";
    default:
      return "Needs review";
  }
}

function buildCurrentStatus(routingStatus: string, fulfillmentStatus: string): string {
  return `Routing: ${routingStatus} · Fulfillment: ${fulfillmentStatus}`;
}

/** Build VO-based attention items from the same queries as the exceptions page. */
async function fetchVendorOrderAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const stuckBefore = new Date(now.getTime() - ROUTING_STUCK_MS);
  const reconciliationStaleBefore = new Date(now.getTime() - DELIVERECT_RECONCILIATION_STALE_MS);
  const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);

  const [failed, stuckPending, deliverectReconciliationOverdue, stuckSentConfirmed] = await Promise.all([
    prisma.vendorOrder.findMany({
      where: { routingStatus: VendorRoutingStatus.failed },
      include: VO_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.pending,
        createdAt: { lt: stuckBefore },
      },
      include: VO_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        deliverectSubmittedAt: { not: null, lt: reconciliationStaleBefore },
        OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
      },
      include: VO_INCLUDE,
      orderBy: { deliverectSubmittedAt: "desc" },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        routingStatus: { in: [VendorRoutingStatus.sent, VendorRoutingStatus.confirmed] },
        createdAt: { lt: twoHoursAgo },
      },
      include: VO_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: TAKE_VO,
    }),
  ]);

  if (deliverectReconciliationOverdue.length > 0) {
    const sample = deliverectReconciliationOverdue
      .slice(0, 12)
      .map((v) => v.id)
      .join(",");
    console.info(
      `[Deliverect reconciliation] overdue_queue_snapshot count=${deliverectReconciliationOverdue.length} ` +
        `thresholdMinutes=${DELIVERECT_RECONCILIATION_STALE_MINUTES} sampleVendorOrderIds=${sample}` +
        (deliverectReconciliationOverdue.length > 12 ? "…" : "")
    );
  }

  const items: AdminAttentionItem[] = [];
  const seenVoIds = new Set<string>();

  for (const vo of failed) {
    if (vo.fulfillmentStatus !== "pending") continue;
    const urgency = getExceptionUrgency(vo.createdAt);
    const reason: AdminAttentionReason = "routing_failed";
    items.push({
      id: `vendor_order:${vo.id}`,
      scope: "vendor_order",
      reason,
      bucket: reasonToBucket(reason),
      severity: urgencyToSeverity(urgency.urgency),
      ageMinutes: urgency.ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason, vo.fulfillmentStatus),
      reasonLabel: reasonToLabel(reason, vo),
      currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      primaryEntityHref: `/admin/orders/${vo.orderId}`,
      order: vo.order ?? undefined,
      vendor: vo.vendor ?? undefined,
      deliverectLastError: vo.deliverectLastError,
      deliverectAttempts: vo.deliverectAttempts,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
    });
  }

  for (const vo of stuckPending) {
    if (vo.fulfillmentStatus !== "pending") continue;
    const urgency = getExceptionUrgency(vo.createdAt);
    const reason: AdminAttentionReason = "routing_stuck";
    items.push({
      id: `vendor_order:${vo.id}`,
      scope: "vendor_order",
      reason,
      bucket: reasonToBucket(reason),
      severity: urgencyToSeverity(urgency.urgency),
      ageMinutes: urgency.ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason, vo.fulfillmentStatus),
      reasonLabel: reasonToLabel(reason, vo),
      currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      primaryEntityHref: `/admin/orders/${vo.orderId}`,
      order: vo.order ?? undefined,
      vendor: vo.vendor ?? undefined,
      deliverectLastError: vo.deliverectLastError,
      deliverectAttempts: vo.deliverectAttempts,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
    });
    seenVoIds.add(vo.id);
  }

  for (const vo of deliverectReconciliationOverdue) {
    const urgency = getExceptionUrgency(vo.deliverectSubmittedAt ?? vo.createdAt);
    const reason: AdminAttentionReason = "deliverect_reconciliation_overdue";
    items.push({
      id: `vendor_order:${vo.id}`,
      scope: "vendor_order",
      reason,
      bucket: reasonToBucket(reason),
      severity: urgencyToSeverity(urgency.urgency),
      ageMinutes: urgency.ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason, vo.fulfillmentStatus),
      reasonLabel: reasonToLabel(reason, vo),
      currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      primaryEntityHref: `/admin/orders/${vo.orderId}`,
      order: vo.order ?? undefined,
      vendor: vo.vendor ?? undefined,
      deliverectLastError: vo.deliverectLastError,
      deliverectAttempts: vo.deliverectAttempts,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
      deliverectDiagnostic: describeDeliverectReconciliationForAdmin(
        {
          routingStatus: vo.routingStatus,
          fulfillmentStatus: vo.fulfillmentStatus,
          deliverectOrderId: vo.deliverectOrderId,
          lastDeliverectResponse: vo.lastDeliverectResponse,
          lastExternalStatusAt: vo.lastExternalStatusAt,
          deliverectSubmittedAt: vo.deliverectSubmittedAt,
          createdAt: vo.createdAt,
        },
        { now, staleMinutes: DELIVERECT_RECONCILIATION_STALE_MINUTES }
      ),
    });
    seenVoIds.add(vo.id);
  }

  for (const vo of stuckSentConfirmed) {
    if (seenVoIds.has(vo.id)) continue;
    const urgency = getExceptionUrgency(vo.createdAt);
    const reason: AdminAttentionReason = "fulfillment_stuck";
    items.push({
      id: `vendor_order:${vo.id}`,
      scope: "vendor_order",
      reason,
      bucket: reasonToBucket(reason),
      severity: urgencyToSeverity(urgency.urgency),
      ageMinutes: urgency.ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason, vo.fulfillmentStatus),
      reasonLabel: reasonToLabel(reason, vo),
      currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      primaryEntityHref: `/admin/orders/${vo.orderId}`,
      order: vo.order ?? undefined,
      vendor: vo.vendor ?? undefined,
      deliverectLastError: vo.deliverectLastError,
      deliverectAttempts: vo.deliverectAttempts,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
    });
  }

  return items;
}

/** Build attention items from failed RefundAttempt rows (refund attempted but Stripe/precheck failed). Excludes attempts dismissed as legacy/test. */
async function fetchFailedRefundAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const failed = await prisma.refundAttempt.findMany({
    where: { status: "failed", dismissedAsLegacyAt: null },
    include: { order: { select: { id: true, customerPhone: true, pod: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: TAKE_REFUND_FAILED,
  });

  return failed.map((ra) => {
    const ageMinutes = ageMinutesUtil(ra.updatedAt, now.getTime());
    const reason: AdminAttentionReason = "refund_failed";
    return {
      id: `refund_attempt:${ra.id}`,
      scope: (ra.vendorOrderId ? "vendor_order" : "order") as AdminAttentionScope,
      reason,
      bucket: reasonToBucket(reason),
      severity: ageMinutes > 60 ? "critical" : "high",
      ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason),
      reasonLabel: reasonToLabel(reason, ra),
      currentStatus: "Refund failed",
      orderId: ra.orderId,
      vendorOrderId: ra.vendorOrderId,
      primaryEntityHref: `/admin/orders/${ra.orderId}`,
      order: ra.order
        ? { id: ra.order.id, customerPhone: ra.order.customerPhone, pod: ra.order.pod ?? undefined }
        : undefined,
    };
  });
}

/**
 * Returns all attention items: VO-level (failed, stuck routing, stuck fulfillment),
 * order-level (open issues only for orders that have no VO-level item), and
 * failed refund attempts. Dedupe: one item per VO/order/refund-attempt; refund items
 * are independent (same order can have both a routing item and a refund_failed item).
 */
export async function getAttentionItems(): Promise<AdminAttentionItem[]> {
  const now = new Date();
  const [voItems, refundFailedItems] = await Promise.all([
    fetchVendorOrderAttentionItems(now),
    fetchFailedRefundAttentionItems(now),
  ]);
  const orderIdsWithVoItems = new Set(voItems.map((i) => i.orderId));

  const openIssueOrderIds = await getOrderIdsWithOpenIssues();
  const orderIdsNeedingOrderLevelItem = openIssueOrderIds.filter((id) => !orderIdsWithVoItems.has(id));

  let orderLevelItems: AdminAttentionItem[] = [];
  if (orderIdsNeedingOrderLevelItem.length > 0) {
    const limitedOrderIds = orderIdsNeedingOrderLevelItem.slice(0, TAKE_OPEN_ISSUE_ORDERS);
    const orders = await prisma.order.findMany({
      where: { id: { in: limitedOrderIds } },
      select: { id: true, customerPhone: true, createdAt: true, pod: { select: { name: true } } },
    });
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    orderLevelItems = limitedOrderIds.map((orderId) => {
      const order = orderMap.get(orderId);
      const createdAt = order?.createdAt ?? now;
      const ageMinutes = ageMinutesUtil(createdAt, now.getTime());
      return {
        id: `order:${orderId}`,
        scope: "order" as AdminAttentionScope,
        reason: "open_issue" as AdminAttentionReason,
        bucket: "investigation" as AdminAttentionBucket,
        severity: "medium" as AdminAttentionSeverity,
        ageMinutes,
        recommendedAction: "resolve_issue" as AdminRecommendedAction,
        reasonLabel: reasonToLabel("open_issue"),
        currentStatus: "Open issue",
        orderId,
        vendorOrderId: null,
        primaryEntityHref: `/admin/orders/${orderId}`,
        order: order
          ? { id: order.id, customerPhone: order.customerPhone, pod: order.pod ?? undefined }
          : undefined,
      };
    });
  }

  const all = [...voItems, ...orderLevelItems, ...refundFailedItems];
  return all.sort((a, b) => b.ageMinutes - a.ageMinutes);
}

/**
 * Returns order IDs that need attention (for Orders page "Needs attention only" filter).
 * Uses minimal queries (orderId-only) to avoid building full attention items.
 * Matches getAttentionItems scope: failed/stuck VO + open issues + refund failed.
 */
export async function getOrderIdsNeedingAttention(): Promise<string[]> {
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - ROUTING_STUCK_MS);
  const reconciliationStaleBefore = new Date(now.getTime() - DELIVERECT_RECONCILIATION_STALE_MS);
  const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);

  const [failed, stuckPending, deliverectReconciliationOverdue, stuckSentConfirmed, openIssueOrderIds, refundFailed] =
    await Promise.all([
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.failed,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
      },
      select: { orderId: true },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.pending,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        createdAt: { lt: stuckBefore },
      },
      select: { orderId: true },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        deliverectSubmittedAt: { not: null, lt: reconciliationStaleBefore },
        OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
      },
      select: { orderId: true },
      take: TAKE_VO,
    }),
    prisma.vendorOrder.findMany({
      where: {
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        routingStatus: { in: [VendorRoutingStatus.sent, VendorRoutingStatus.confirmed] },
        createdAt: { lt: twoHoursAgo },
      },
      select: { orderId: true },
      take: TAKE_VO,
    }),
    getOrderIdsWithOpenIssues(),
    prisma.refundAttempt.findMany({
      where: { status: "failed", dismissedAsLegacyAt: null },
      select: { orderId: true },
      take: TAKE_REFUND_FAILED,
    }),
  ]);

  const voOrderIds = [...failed, ...stuckPending, ...deliverectReconciliationOverdue, ...stuckSentConfirmed].map(
    (v) => v.orderId
  );
  const refundOrderIds = refundFailed.map((r) => r.orderId);
  const orderIds = [...new Set([...voOrderIds, ...openIssueOrderIds, ...refundOrderIds])];
  return orderIds;
}
