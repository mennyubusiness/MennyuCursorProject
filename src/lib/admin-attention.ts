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
import {
  getDeliverectAdminActionGuidance,
  getDeliverectAdminCompactBadges,
  type DeliverectActionSeverity,
} from "@/lib/deliverect-admin-lifecycle";
import { getExceptionUrgency } from "@/lib/admin-urgency";
import {
  ACTIVE_ORDER_ISSUE_STATUSES,
  customerSupportIssueTypeLabel,
} from "@/domain/order-support-issue";
import { getOrderIdsWithOpenIssues } from "@/services/issues.service";
import { ageMinutes as ageMinutesUtil } from "@/lib/date-utils";
import {
  isReversalPendingAttentionStale,
  VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES,
} from "@/lib/vendor-clawback-status";
import { VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS } from "@/services/vendor-payout-transfer-reversal.service";
import {
  canManualRecoverVendorOrder,
  canRetryRouting,
  formatOrderPaymentLabel,
  getNeedsAttentionSuggestedActions,
  type OrderRecoverySnapshot,
  type VendorOrderRecoverySnapshot,
} from "@/lib/admin-needs-attention-actions";

// ---- Types (normalized attention item) ----

export type AdminAttentionScope = "order" | "vendor_order" | "issue";

export type AdminAttentionReason =
  | "routing_failed"
  | "routing_stuck"
  | "deliverect_reconciliation_overdue"
  | "fulfillment_stuck"
  | "open_issue"
  | "customer_reported_issue"
  | "refund_failed"
  | "refund_review_required"
  | "vendor_clawback_failed"
  | "vendor_clawback_pending"
  | "vendor_clawback_missing"
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
  issueCustomerMessage?: string | null;
  /** Set when vendor has left a response on a customer issue. */
  vendorResponded?: boolean;

  /** Direct link for admin queue rows (e.g. /admin/orders/{orderId}#payments-refunds). */
  primaryEntityHref: string;

  /** Refund queue metadata (failed ledger / review-required). */
  refundAmountCents?: number;
  refundScope?: string;
  refundInitiatedBy?: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  stripeRefundId?: string | null;
  orderRefundId?: string | null;
  refundAttemptId?: string | null;
  retryMayBePossible?: boolean;

  /** Vendor clawback / transfer reversal queue metadata. */
  clawbackStatus?: string;
  clawbackAmountCents?: number;
  clawbackRecoveredCents?: number;
  clawbackPendingCents?: number;
  clawbackFailedCents?: number;
  vendorPayoutTransferReversalId?: string | null;
  stripeTransferId?: string | null;
  stripeTransferReversalId?: string | null;
  paymentRefundStatus?: string | null;

  order?: {
    id: string;
    customerPhone: string | null;
    customerEmail?: string | null;
    status?: string;
    pod?: { id: string; name: string } | null;
  };
  vendor?: { name: string };
  /** Parent order payment / lifecycle (vendor-order queue). */
  orderStatus?: string;
  paymentLabel?: string;
  vendorOrderRoutingStatus?: string;
  vendorOrderFulfillmentStatus?: string;
  manuallyRecoveredAt?: Date | null;
  manualRecoveryNotes?: string | null;
  canRetryRouting?: boolean;
  canManualRecover?: boolean;
  suggestedActions?: import("@/lib/admin-needs-attention-actions").WorkbenchSuggestedAction[];
  deliverectLastError?: string | null;
  deliverectAttempts?: number | null;
  deliverectSubmittedAt?: Date | null;
  /** Longer plain-English diagnostic for Deliverect reconciliation cases. */
  deliverectDiagnostic?: string | null;
  /** Compact pills aligned with order-detail Deliverect diagnostics. */
  deliverectBadges?: { label: string; className: string }[];
  /** Action-oriented copy for vendor-order triage (Deliverect-aware). */
  deliverectGuidance?: {
    stateSummary: string;
    recommendedAction: string;
    severity: DeliverectActionSeverity;
    automaticFallbackAttempted: boolean;
    manualRecoveryBlocksAuto: boolean;
  };
}

// ---- Constants (aligned with exceptions page and orders filter) ----

const ROUTING_STUCK_MS = ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000;
const DELIVERECT_RECONCILIATION_STALE_MS = DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TAKE_VO = 200;
const TAKE_OPEN_ISSUE_ORDERS = 500;
const TAKE_REFUND_FAILED = 100;
const TAKE_ORDER_REFUND_ATTENTION = 100;
const TAKE_VENDOR_CLAWBACK_ATTENTION = 100;

function paymentsRefundsHref(orderId: string): string {
  return `/admin/orders/${orderId}#payments-refunds`;
}

function orderIssuesHref(orderId: string): string {
  return `/admin/orders/${orderId}#order-issues`;
}

const VO_INCLUDE = {
  order: {
    select: {
      id: true,
      status: true,
      customerPhone: true,
      customerEmail: true,
      pod: { select: { id: true, name: true } },
    },
  },
  vendor: { select: { name: true, deliverectChannelLinkId: true } },
} as const;

type VoAttentionRow = Awaited<
  ReturnType<typeof prisma.vendorOrder.findMany<{ include: typeof VO_INCLUDE }>>
>[number];

function voRecoverySnapshot(vo: VoAttentionRow): VendorOrderRecoverySnapshot {
  return {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    deliverectOrderId: vo.deliverectOrderId,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
  };
}

function orderRecoverySnapshot(vo: VoAttentionRow): OrderRecoverySnapshot {
  return { status: vo.order?.status ?? "unknown" };
}

function attachVendorOrderAttentionActions(
  base: AdminAttentionItem,
  vo: VoAttentionRow,
  reason: AdminAttentionReason
): AdminAttentionItem {
  const voSnap = voRecoverySnapshot(vo);
  const orderSnap = orderRecoverySnapshot(vo);
  return {
    ...base,
    order: vo.order
      ? {
          id: vo.order.id,
          customerPhone: vo.order.customerPhone,
          customerEmail: vo.order.customerEmail,
          status: vo.order.status,
          pod: vo.order.pod ?? undefined,
        }
      : undefined,
    orderStatus: vo.order?.status,
    paymentLabel: vo.order?.status ? formatOrderPaymentLabel(vo.order.status) : undefined,
    vendorOrderRoutingStatus: vo.routingStatus,
    vendorOrderFulfillmentStatus: vo.fulfillmentStatus,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
    manualRecoveryNotes: vo.manualRecoveryNotes,
    canRetryRouting: canRetryRouting(voSnap, orderSnap),
    canManualRecover: canManualRecoverVendorOrder(voSnap, orderSnap),
    suggestedActions: getNeedsAttentionSuggestedActions(reason, voSnap, orderSnap),
    recommendedAction: reasonToRecommendedAction(reason, vo.fulfillmentStatus, voSnap, orderSnap),
  };
}

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
    case "refund_review_required":
    case "vendor_clawback_failed":
    case "vendor_clawback_pending":
    case "vendor_clawback_missing":
    case "financial_resolution":
      return "financial_resolution";
    default:
      return "investigation";
  }
}

function reasonToRecommendedAction(
  reason: AdminAttentionReason,
  fulfillmentStatus?: string,
  vo?: VendorOrderRecoverySnapshot,
  order?: OrderRecoverySnapshot
): AdminRecommendedAction {
  switch (reason) {
    case "routing_failed":
    case "routing_stuck":
      if (vo && order && canRetryRouting(vo, order)) return "retry_routing";
      if (vo && order && canManualRecoverVendorOrder(vo, order)) return "mark_manually_received";
      return fulfillmentStatus === "pending" ? "retry_routing" : "view_order";
    case "deliverect_reconciliation_overdue":
      if (vo && order && canManualRecoverVendorOrder(vo, order)) return "mark_manually_received";
      if (vo && order && canRetryRouting(vo, order)) return "retry_routing";
      return "view_order";
    case "manual_recovery_required":
      return "mark_manually_received";
    case "fulfillment_stuck":
      return "view_order";
    case "open_issue":
    case "customer_reported_issue":
      return "resolve_issue";
    case "refund_failed":
    case "refund_review_required":
    case "vendor_clawback_failed":
    case "vendor_clawback_pending":
    case "vendor_clawback_missing":
      return "view_order";
    case "financial_resolution":
      return "view_order";
    default:
      return "investigate";
  }
}

/** Maps queue VO rows to compact Deliverect pills (same helper as order detail). */
function voToDeliverectInput(vo: {
  routingStatus: string;
  fulfillmentStatus: string;
  deliverectOrderId: string | null;
  lastDeliverectResponse: unknown;
  lastExternalStatusAt: Date | null;
  lastExternalStatus?: string | null;
  deliverectSubmittedAt: Date | null;
  createdAt: Date;
  manuallyRecoveredAt: Date | null;
  deliverectLastError?: string | null;
  statusAuthority: import("@prisma/client").VendorOrderStatusAuthority | null;
  lastStatusSource: import("@prisma/client").VendorOrderStatusSource | null;
  deliverectAutoRecheckAttemptedAt: Date | null;
  deliverectAutoRecheckResult: string | null;
  deliverectChannelLinkId: string | null;
  vendor: { deliverectChannelLinkId: string | null } | null;
}) {
  return {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    lastExternalStatus: vo.lastExternalStatus ?? undefined,
    deliverectOrderId: vo.deliverectOrderId,
    lastDeliverectResponse: vo.lastDeliverectResponse,
    lastExternalStatusAt: vo.lastExternalStatusAt,
    deliverectSubmittedAt: vo.deliverectSubmittedAt,
    createdAt: vo.createdAt,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
    deliverectLastError: vo.deliverectLastError,
    statusAuthority: vo.statusAuthority,
    lastStatusSource: vo.lastStatusSource,
    deliverectAutoRecheckAttemptedAt: vo.deliverectAutoRecheckAttemptedAt,
    deliverectAutoRecheckResult: vo.deliverectAutoRecheckResult,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendorDeliverectChannelLinkId: vo.vendor?.deliverectChannelLinkId,
  };
}

function deliverectBadgesForAttentionVo(vo: Parameters<typeof voToDeliverectInput>[0]) {
  return getDeliverectAdminCompactBadges(voToDeliverectInput(vo));
}

function deliverectGuidanceForAttentionVo(vo: Parameters<typeof voToDeliverectInput>[0]) {
  const g = getDeliverectAdminActionGuidance(voToDeliverectInput(vo));
  return {
    stateSummary: g.stateSummary,
    recommendedAction: g.recommendedAction,
    severity: g.severity,
    automaticFallbackAttempted: g.automaticFallbackAttempted,
    manualRecoveryBlocksAuto: g.manualRecoveryBlocksAuto,
  };
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
    case "customer_reported_issue":
      return vo && "failureMessage" in vo
        ? String(vo.failureMessage).slice(0, 80)
        : "Customer reported an order issue";
    case "refund_failed":
      return vo && "failureMessage" in vo && vo.failureMessage
        ? `Refund failed: ${vo.failureMessage.slice(0, 80)}`
        : "Refund failed — complete in Payments & Refunds";
    case "refund_review_required":
      return "Customer refund awaiting admin review — Payments & Refunds";
    case "vendor_clawback_failed":
      return vo && "failureMessage" in vo && vo.failureMessage
        ? `Vendor clawback failed: ${vo.failureMessage.slice(0, 80)}`
        : "Vendor clawback failed — retry transfer reversal";
    case "vendor_clawback_pending":
      return `Vendor clawback pending for ${VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES}+ min`;
    case "vendor_clawback_missing":
      return "Vendor clawback setup missing after customer refund";
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
    items.push(
      attachVendorOrderAttentionActions(
        {
          id: `vendor_order:${vo.id}`,
          scope: "vendor_order",
          reason,
          bucket: reasonToBucket(reason),
          severity: urgencyToSeverity(urgency.urgency),
          ageMinutes: urgency.ageMinutes,
          recommendedAction: "retry_routing",
          reasonLabel: reasonToLabel(reason, vo),
          currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          primaryEntityHref: `/admin/orders/${vo.orderId}`,
          vendor: vo.vendor ?? undefined,
          deliverectLastError: vo.deliverectLastError,
          deliverectAttempts: vo.deliverectAttempts,
          deliverectSubmittedAt: vo.deliverectSubmittedAt,
          deliverectBadges: deliverectBadgesForAttentionVo(vo),
          deliverectGuidance: deliverectGuidanceForAttentionVo(vo),
        },
        vo,
        reason
      )
    );
  }

  for (const vo of stuckPending) {
    if (vo.fulfillmentStatus !== "pending") continue;
    const urgency = getExceptionUrgency(vo.createdAt);
    const reason: AdminAttentionReason = "routing_stuck";
    items.push(
      attachVendorOrderAttentionActions(
        {
          id: `vendor_order:${vo.id}`,
          scope: "vendor_order",
          reason,
          bucket: reasonToBucket(reason),
          severity: urgencyToSeverity(urgency.urgency),
          ageMinutes: urgency.ageMinutes,
          recommendedAction: "retry_routing",
          reasonLabel: reasonToLabel(reason, vo),
          currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          primaryEntityHref: `/admin/orders/${vo.orderId}`,
          vendor: vo.vendor ?? undefined,
          deliverectLastError: vo.deliverectLastError,
          deliverectAttempts: vo.deliverectAttempts,
          deliverectSubmittedAt: vo.deliverectSubmittedAt,
          deliverectBadges: deliverectBadgesForAttentionVo(vo),
        },
        vo,
        reason
      )
    );
    seenVoIds.add(vo.id);
  }

  for (const vo of deliverectReconciliationOverdue) {
    const urgency = getExceptionUrgency(vo.deliverectSubmittedAt ?? vo.createdAt);
    const reason: AdminAttentionReason = "deliverect_reconciliation_overdue";
    items.push(
      attachVendorOrderAttentionActions(
        {
          id: `vendor_order:${vo.id}`,
          scope: "vendor_order",
          reason,
          bucket: reasonToBucket(reason),
          severity: urgencyToSeverity(urgency.urgency),
          ageMinutes: urgency.ageMinutes,
          recommendedAction: "mark_manually_received",
          reasonLabel: reasonToLabel(reason, vo),
          currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          primaryEntityHref: `/admin/orders/${vo.orderId}`,
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
          deliverectBadges: deliverectBadgesForAttentionVo(vo),
          deliverectGuidance: deliverectGuidanceForAttentionVo(vo),
        },
        vo,
        reason
      )
    );
    seenVoIds.add(vo.id);
  }

  for (const vo of stuckSentConfirmed) {
    if (seenVoIds.has(vo.id)) continue;
    const urgency = getExceptionUrgency(vo.createdAt);
    const reason: AdminAttentionReason = "fulfillment_stuck";
    items.push(
      attachVendorOrderAttentionActions(
        {
          id: `vendor_order:${vo.id}`,
          scope: "vendor_order",
          reason,
          bucket: reasonToBucket(reason),
          severity: urgencyToSeverity(urgency.urgency),
          ageMinutes: urgency.ageMinutes,
          recommendedAction: "view_order",
          reasonLabel: reasonToLabel(reason, vo),
          currentStatus: buildCurrentStatus(vo.routingStatus, vo.fulfillmentStatus),
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          primaryEntityHref: `/admin/orders/${vo.orderId}`,
          vendor: vo.vendor ?? undefined,
          deliverectLastError: vo.deliverectLastError,
          deliverectAttempts: vo.deliverectAttempts,
          deliverectSubmittedAt: vo.deliverectSubmittedAt,
          deliverectBadges: deliverectBadgesForAttentionVo(vo),
          deliverectGuidance: deliverectGuidanceForAttentionVo(vo),
        },
        vo,
        reason
      )
    );
  }

  return items;
}

/** Customer-reported OrderIssue rows (open / reviewing). */
async function fetchCustomerReportedIssueAttentionItems(
  now: Date
): Promise<AdminAttentionItem[]> {
  const rows = await prisma.orderIssue.findMany({
    where: {
      submittedByRole: "customer",
      status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    take: TAKE_ORDER_REFUND_ATTENTION,
    include: {
      order: { select: { id: true, customerPhone: true, pod: { select: { id: true, name: true } } } },
      vendorOrder: { select: { vendor: { select: { name: true } } } },
    },
  });

  return rows.map((r) => {
    const ageMinutes = ageMinutesUtil(r.createdAt, now.getTime());
    const reason: AdminAttentionReason = "customer_reported_issue";
    const vendorLabel = r.vendorOrder?.vendor.name;
    return {
      id: `customer_issue:${r.id}`,
      scope: (r.vendorOrderId ? "vendor_order" : "order") as AdminAttentionScope,
      reason,
      bucket: reasonToBucket(reason),
      severity: r.priority === "high" ? "high" : ageMinutes > 120 ? "high" : "medium",
      ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason),
      reasonLabel: `${customerSupportIssueTypeLabel(r.type)}${vendorLabel ? ` · ${vendorLabel}` : ""}`,
      currentStatus: `Issue ${r.status}`,
      orderId: r.orderId,
      vendorOrderId: r.vendorOrderId,
      issueId: r.id,
      issueType: r.type,
      issueCustomerMessage: r.customerMessage,
      vendorResponded: Boolean(r.vendorResponse?.trim()),
      primaryEntityHref: orderIssuesHref(r.orderId),
      order: r.order
        ? { id: r.order.id, customerPhone: r.order.customerPhone, pod: r.order.pod ?? undefined }
        : undefined,
      vendor: r.vendorOrder?.vendor ? { name: r.vendorOrder.vendor.name } : undefined,
    };
  });
}

/** Failed OrderRefund ledger rows (Phase 1+). */
async function fetchFailedOrderRefundAttentionItems(
  now: Date,
  excludeRefundAttemptIds: Set<string>
): Promise<AdminAttentionItem[]> {
  const failed = await prisma.orderRefund.findMany({
    where: { status: "failed" },
    include: {
      order: { select: { id: true, customerPhone: true, pod: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: TAKE_ORDER_REFUND_ATTENTION,
  });

  return failed
    .filter((r) => !r.refundAttemptId || !excludeRefundAttemptIds.has(r.refundAttemptId))
    .map((r) => {
      const ageMinutes = ageMinutesUtil(r.updatedAt, now.getTime());
      const reason: AdminAttentionReason = "refund_failed";
      const retryMayBePossible =
        r.failureCode === "STRIPE_REFUND_FAILED" || r.failureCode === "PRECHECK_FAILED";
      return {
        id: `order_refund:${r.id}`,
        scope: (r.vendorOrderId ? "vendor_order" : "order") as AdminAttentionScope,
        reason,
        bucket: reasonToBucket(reason),
        severity: ageMinutes > 60 ? "critical" : "high",
        ageMinutes,
        recommendedAction: reasonToRecommendedAction(reason),
        reasonLabel: reasonToLabel(reason, {
          failureMessage: r.failureMessage,
        }),
        currentStatus: `Refund failed (${r.refundScope})`,
        orderId: r.orderId,
        vendorOrderId: r.vendorOrderId,
        primaryEntityHref: paymentsRefundsHref(r.orderId),
        order: r.order
          ? {
              id: r.order.id,
              customerPhone: r.order.customerPhone,
              pod: r.order.pod ?? undefined,
            }
          : undefined,
        refundAmountCents: r.amountCents,
        refundScope: r.refundScope,
        refundInitiatedBy: r.initiatedByRole,
        failureCode: r.failureCode,
        failureMessage: r.failureMessage,
        stripeRefundId: r.stripeRefundId,
        orderRefundId: r.id,
        refundAttemptId: r.refundAttemptId,
        retryMayBePossible,
      };
    });
}

/** Pending OrderRefund awaiting admin review (no Stripe attempt). */
async function fetchRefundReviewRequiredAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const pending = await prisma.orderRefund.findMany({
    where: {
      status: "pending",
      initiatedByRole: { not: "admin" },
      stripeRefundId: null,
      adminNote: { contains: "Awaiting platform admin review" },
    },
    include: {
      order: { select: { id: true, customerPhone: true, pod: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: TAKE_ORDER_REFUND_ATTENTION,
  });

  return pending.map((r) => {
    const ageMinutes = ageMinutesUtil(r.createdAt, now.getTime());
    const reason: AdminAttentionReason = "refund_review_required";
    return {
      id: `order_refund_review:${r.id}`,
      scope: (r.vendorOrderId ? "vendor_order" : "order") as AdminAttentionScope,
      reason,
      bucket: reasonToBucket(reason),
      severity: ageMinutes > 120 ? "critical" : "high",
      ageMinutes,
      recommendedAction: reasonToRecommendedAction(reason),
      reasonLabel: reasonToLabel(reason),
      currentStatus: `Refund review (${r.refundScope})`,
      orderId: r.orderId,
      vendorOrderId: r.vendorOrderId,
      primaryEntityHref: paymentsRefundsHref(r.orderId),
      order: r.order
        ? { id: r.order.id, customerPhone: r.order.customerPhone, pod: r.order.pod ?? undefined }
        : undefined,
      refundAmountCents: r.amountCents,
      refundScope: r.refundScope,
      refundInitiatedBy: r.initiatedByRole,
      orderRefundId: r.id,
      retryMayBePossible: true,
    };
  });
}

/** Failed RefundAttempt rows (legacy); skip when linked OrderRefund already failed. */
async function fetchFailedRefundAttemptAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const failed = await prisma.refundAttempt.findMany({
    where: { status: "failed", dismissedAsLegacyAt: null },
    include: {
      order: { select: { id: true, customerPhone: true, pod: { select: { id: true, name: true } } } },
      orderRefund: { select: { id: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: TAKE_REFUND_FAILED,
  });

  return failed
    .filter((ra) => !ra.orderRefund || ra.orderRefund.status === "failed")
    .map((ra) => {
      const ageMinutes = ageMinutesUtil(ra.updatedAt, now.getTime());
      const reason: AdminAttentionReason = "refund_failed";
      const retryMayBePossible =
        ra.failureCode === "STRIPE_REFUND_FAILED" || ra.failureCode === "PRECHECK_FAILED";
      return {
        id: `refund_attempt:${ra.id}`,
        scope: (ra.vendorOrderId ? "vendor_order" : "order") as AdminAttentionScope,
        reason,
        bucket: reasonToBucket(reason),
        severity: ageMinutes > 60 ? "critical" : "high",
        ageMinutes,
        recommendedAction: reasonToRecommendedAction(reason),
        reasonLabel: reasonToLabel(reason, ra),
        currentStatus: "Refund failed (legacy attempt)",
        orderId: ra.orderId,
        vendorOrderId: ra.vendorOrderId,
        primaryEntityHref: paymentsRefundsHref(ra.orderId),
        order: ra.order
          ? { id: ra.order.id, customerPhone: ra.order.customerPhone, pod: ra.order.pod ?? undefined }
          : undefined,
        refundAmountCents: ra.amountCents,
        refundInitiatedBy: "legacy_attempt",
        failureCode: ra.failureCode,
        failureMessage: ra.failureMessage,
        stripeRefundId: ra.stripeRefundId,
        refundAttemptId: ra.id,
        orderRefundId: ra.orderRefund?.id ?? null,
        retryMayBePossible,
      };
    });
}

type ClawbackReversalAttentionRow = Awaited<
  ReturnType<
    typeof prisma.vendorPayoutTransferReversal.findMany<{
      include: {
        order: {
          select: {
            id: true;
            customerPhone: true;
            paymentRefundStatus: true;
            pod: { select: { id: true; name: true } };
          };
        };
        vendor: { select: { name: true } };
        vendorPayoutTransfer: { select: { stripeTransferId: true } };
      };
    }>
  >
>[number];

function mapClawbackReversalAttentionItem(
  row: ClawbackReversalAttentionRow,
  now: Date,
  reason: Extract<
    AdminAttentionReason,
    "vendor_clawback_failed" | "vendor_clawback_pending"
  >
): AdminAttentionItem {
  const anchor = row.failedAt ?? row.submittedAt ?? row.createdAt;
  const ageMinutes = ageMinutesUtil(anchor, now.getTime());
  return {
    id: `vendor_clawback:${reason}:${row.id}`,
    scope: "vendor_order",
    reason,
    bucket: reasonToBucket(reason),
    severity: reason === "vendor_clawback_failed" ? (ageMinutes > 60 ? "critical" : "high") : "medium",
    ageMinutes,
    recommendedAction: reasonToRecommendedAction(reason),
    reasonLabel: reasonToLabel(reason, { failureMessage: row.failureMessage }),
    currentStatus: `Reversal ${row.status}`,
    orderId: row.orderId,
    vendorOrderId: row.vendorOrderId,
    primaryEntityHref: paymentsRefundsHref(row.orderId),
    order: row.order
      ? {
          id: row.order.id,
          customerPhone: row.order.customerPhone,
          pod: row.order.pod ?? undefined,
        }
      : undefined,
    vendor: row.vendor ? { name: row.vendor.name } : undefined,
    paymentRefundStatus: row.order?.paymentRefundStatus ?? null,
    clawbackStatus: reason === "vendor_clawback_failed" ? "failed" : "pending",
    clawbackAmountCents: row.amountCents,
    clawbackPendingCents: reason === "vendor_clawback_pending" ? row.amountCents : 0,
    clawbackFailedCents: reason === "vendor_clawback_failed" ? row.amountCents : 0,
    vendorPayoutTransferReversalId: row.id,
    stripeTransferId: row.vendorPayoutTransfer.stripeTransferId,
    stripeTransferReversalId: row.stripeTransferReversalId,
    failureMessage: row.failureMessage,
    refundAttemptId: row.refundAttemptId,
  };
}

async function fetchFailedVendorClawbackAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const failed = await prisma.vendorPayoutTransferReversal.findMany({
    where: { status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed },
    include: {
      order: {
        select: {
          id: true,
          customerPhone: true,
          paymentRefundStatus: true,
          pod: { select: { id: true, name: true } },
        },
      },
      vendor: { select: { name: true } },
      vendorPayoutTransfer: { select: { stripeTransferId: true } },
    },
    orderBy: { failedAt: "desc" },
    take: TAKE_VENDOR_CLAWBACK_ATTENTION,
  });

  return failed.map((row) => mapClawbackReversalAttentionItem(row, now, "vendor_clawback_failed"));
}

async function fetchStalePendingVendorClawbackAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const staleBefore = new Date(
    now.getTime() - VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES * 60 * 1000
  );
  const pending = await prisma.vendorPayoutTransferReversal.findMany({
    where: {
      status: {
        in: [
          VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
          VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.submitted,
        ],
      },
      createdAt: { lt: staleBefore },
    },
    include: {
      order: {
        select: {
          id: true,
          customerPhone: true,
          paymentRefundStatus: true,
          pod: { select: { id: true, name: true } },
        },
      },
      vendor: { select: { name: true } },
      vendorPayoutTransfer: { select: { stripeTransferId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: TAKE_VENDOR_CLAWBACK_ATTENTION,
  });

  return pending
    .filter((row) =>
      isReversalPendingAttentionStale(
        {
          status: row.status,
          createdAt: row.createdAt,
          submittedAt: row.submittedAt,
        },
        now.getTime()
      )
    )
    .map((row) => mapClawbackReversalAttentionItem(row, now, "vendor_clawback_pending"));
}

async function fetchMissingVendorClawbackAttentionItems(now: Date): Promise<AdminAttentionItem[]> {
  const candidates = await prisma.vendorPayoutTransfer.findMany({
    where: {
      status: "paid",
      stripeTransferId: { not: null },
      vendorOrder: { totalRefundedCents: { gt: 0 } },
    },
    include: {
      vendorOrder: {
        select: {
          id: true,
          orderId: true,
          totalCents: true,
          totalRefundedCents: true,
          vendor: { select: { name: true } },
          order: {
            select: {
              id: true,
              customerPhone: true,
              paymentRefundStatus: true,
              pod: { select: { id: true, name: true } },
            },
          },
        },
      },
      reversals: { select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: TAKE_VENDOR_CLAWBACK_ATTENTION,
  });

  const items: AdminAttentionItem[] = [];
  for (const vpt of candidates) {
    const vo = vpt.vendorOrder;
    if (!vo) continue;
    if (vpt.reversals.length > 0) continue;
    if (vo.totalRefundedCents < vo.totalCents) continue;

    const ageMinutes = ageMinutesUtil(vpt.updatedAt, now.getTime());
    items.push({
      id: `vendor_clawback:missing:${vpt.id}`,
      scope: "vendor_order",
      reason: "vendor_clawback_missing",
      bucket: reasonToBucket("vendor_clawback_missing"),
      severity: ageMinutes > 120 ? "high" : "medium",
      ageMinutes,
      recommendedAction: reasonToRecommendedAction("vendor_clawback_missing"),
      reasonLabel: reasonToLabel("vendor_clawback_missing"),
      currentStatus: "Paid vendor transfer · no reversal row",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      primaryEntityHref: paymentsRefundsHref(vo.orderId),
      order: vo.order
        ? {
            id: vo.order.id,
            customerPhone: vo.order.customerPhone,
            pod: vo.order.pod ?? undefined,
          }
        : undefined,
      vendor: vo.vendor ? { name: vo.vendor.name } : undefined,
      paymentRefundStatus: vo.order?.paymentRefundStatus ?? null,
      clawbackStatus: "manual_review",
      clawbackAmountCents: vpt.amountCents,
      stripeTransferId: vpt.stripeTransferId,
      failureMessage: null,
    });
  }
  return items;
}

/**
 * Returns all attention items: VO-level (failed, stuck routing, stuck fulfillment),
 * order-level (open issues only for orders that have no VO-level item), and
 * failed refund attempts. Dedupe: one item per VO/order/refund-attempt; refund items
 * are independent (same order can have both a routing item and a refund_failed item).
 */
export async function getAttentionItems(): Promise<AdminAttentionItem[]> {
  const now = new Date();
  const [voItems, refundAttemptFailedItems, customerIssueItems, clawbackFailedItems, clawbackPendingItems, clawbackMissingItems] =
    await Promise.all([
    fetchVendorOrderAttentionItems(now),
    fetchFailedRefundAttemptAttentionItems(now),
    fetchCustomerReportedIssueAttentionItems(now),
    fetchFailedVendorClawbackAttentionItems(now),
    fetchStalePendingVendorClawbackAttentionItems(now),
    fetchMissingVendorClawbackAttentionItems(now),
  ]);
  const linkedAttemptIds = new Set(
    refundAttemptFailedItems
      .map((i) => i.refundAttemptId)
      .filter((id): id is string => Boolean(id))
  );
  const [orderRefundFailedItems, refundReviewItems] = await Promise.all([
    fetchFailedOrderRefundAttentionItems(now, linkedAttemptIds),
    fetchRefundReviewRequiredAttentionItems(now),
  ]);
  const refundFailedItems = [
    ...orderRefundFailedItems,
    ...refundAttemptFailedItems,
    ...refundReviewItems,
  ];
  const orderIdsWithVoItems = new Set(voItems.map((i) => i.orderId));

  const openIssueOrderIds = await getOrderIdsWithOpenIssues();
  const orderIdsNeedingOrderLevelItem = openIssueOrderIds.filter((id) => !orderIdsWithVoItems.has(id));

  let orderLevelItems: AdminAttentionItem[] = [];
  if (orderIdsNeedingOrderLevelItem.length > 0) {
    const limitedOrderIds = orderIdsNeedingOrderLevelItem.slice(0, TAKE_OPEN_ISSUE_ORDERS);
    const [orders, openOrderIssues] = await Promise.all([
      prisma.order.findMany({
        where: { id: { in: limitedOrderIds } },
        select: { id: true, customerPhone: true, createdAt: true, pod: { select: { id: true, name: true } } },
      }),
      prisma.orderIssue.findMany({
        where: {
          orderId: { in: limitedOrderIds },
          status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] },
          submittedByRole: { not: "customer" },
        },
        select: { id: true, orderId: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const firstOpenIssueIdByOrder = new Map<string, string>();
    for (const row of openOrderIssues) {
      if (!firstOpenIssueIdByOrder.has(row.orderId)) firstOpenIssueIdByOrder.set(row.orderId, row.id);
    }

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
        issueId: firstOpenIssueIdByOrder.get(orderId) ?? null,
        primaryEntityHref: `/admin/orders/${orderId}`,
        order: order
          ? { id: order.id, customerPhone: order.customerPhone, pod: order.pod ?? undefined }
          : undefined,
      };
    });
  }

  const all = [
    ...voItems,
    ...orderLevelItems,
    ...refundFailedItems,
    ...customerIssueItems,
    ...clawbackFailedItems,
    ...clawbackPendingItems,
    ...clawbackMissingItems,
  ];
  /** Newest / most recent queue entries first (smaller age = order created more recently). */
  return all.sort((a, b) => a.ageMinutes - b.ageMinutes);
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

  const [
    failed,
    stuckPending,
    deliverectReconciliationOverdue,
    stuckSentConfirmed,
    openIssueOrderIds,
    refundFailed,
    orderRefundAttention,
    customerIssueAttention,
    clawbackAttention,
  ] = await Promise.all([
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
    prisma.orderRefund.findMany({
      where: {
        OR: [
          { status: "failed" },
          {
            status: "pending",
            initiatedByRole: { not: "admin" },
            stripeRefundId: null,
            adminNote: { contains: "Awaiting platform admin review" },
          },
        ],
      },
      select: { orderId: true },
      take: TAKE_ORDER_REFUND_ATTENTION,
    }),
    prisma.orderIssue.findMany({
      where: {
        submittedByRole: "customer",
        status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] },
      },
      select: { orderId: true },
      take: TAKE_ORDER_REFUND_ATTENTION,
    }),
    prisma.vendorPayoutTransferReversal.findMany({
      where: {
        OR: [
          { status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.failed },
          {
            status: {
              in: [
                VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
                VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.submitted,
              ],
            },
            createdAt: {
              lt: new Date(now.getTime() - VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES * 60 * 1000),
            },
          },
        ],
      },
      select: { orderId: true },
      take: TAKE_VENDOR_CLAWBACK_ATTENTION,
    }),
  ]);

  const voOrderIds = [...failed, ...stuckPending, ...deliverectReconciliationOverdue, ...stuckSentConfirmed].map(
    (v) => v.orderId
  );
  const refundOrderIds = [
    ...refundFailed.map((r) => r.orderId),
    ...orderRefundAttention.map((r) => r.orderId),
    ...customerIssueAttention.map((r) => r.orderId),
    ...clawbackAttention.map((r) => r.orderId),
  ];
  const orderIds = [...new Set([...voOrderIds, ...openIssueOrderIds, ...refundOrderIds])];
  return orderIds;
}
