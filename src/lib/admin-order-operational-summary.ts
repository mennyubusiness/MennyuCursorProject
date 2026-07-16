/**
 * Canonical admin order operational summary — one source of truth for status badges,
 * attention section, vendor cards, and list/search labels.
 */

import { isActiveOrderIssueStatus } from "@/domain/order-support-issue";
import { getAdminActionState } from "@/lib/admin-actions";
import { getExceptionType, getExceptionReason, type ExceptionType } from "@/lib/admin-exceptions";
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";
import {
  buildAdminOrderHealth,
  orderHasUnresolvedClawback,
  type AdminOrderHealthState,
} from "@/lib/admin-order-health";
import { fulfillmentStatusBadge, providerLabel } from "@/lib/admin-order-detail-ui";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";
import { isSystemIssueActive } from "@/lib/admin-order-detail-ui";

export type AdminOrderOverallStatus =
  | "pending_payment"
  | "routing"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled"
  | "needs_attention";

export type AdminOrderRecoveryState =
  | "none"
  | "recovered_manually"
  | "recovered_automatically";

export type AdminVendorOrderOperationalStatus =
  | "routing_failed"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled"
  | "recovered_manually";

export type AdminOrderIssueSummary = {
  id: string;
  kind: "order_issue" | "vendor_order_issue";
  type: string;
  title: string;
  status: "active" | "resolved";
  vendorName?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
};

export type AdminVendorOrderSummary = {
  vendorOrderId: string;
  vendorName: string;
  statusKey: AdminVendorOrderOperationalStatus;
  statusLabel: string;
  statusDetail?: string;
  recoveryState: AdminOrderRecoveryState;
  receivedLabel: string;
  fulfillmentLabel: string;
  paymentAllocationLabel: string;
  providerLabel: string;
  showRetry: boolean;
  showManualRecovery: boolean;
  historicalRoutingFailure: {
    message: string | null;
    provider: string;
    recoveredAt: string | null;
    recoveredBy: string | null;
    recoveryNotes: string | null;
  } | null;
  exceptionType: ExceptionType | null;
};

function paymentAllocationLabel(
  paymentSummary: AdminOrderPaymentSummary | null,
  vendorOrderId: string
): string {
  const row = paymentSummary?.vendorOrders.find((v) => v.id === vendorOrderId);
  if (!row) return "—";
  const status = (row.transferStatus ?? "").toLowerCase();
  if (status === "paid" || status === "succeeded") return "Paid";
  if (status === "pending" || status === "in_transit") return "Pending";
  if (status === "failed") return "Failed";
  if (!status || status === "missing") return "Not sent";
  return status.replaceAll("_", " ");
}

export type AdminOrderOperationalSummary = {
  orderId: string;
  shortRef: string;
  overallStatus: AdminOrderOverallStatus;
  statusLabel: string;
  statusDetail?: string;
  needsAttention: boolean;
  activeIssueCount: number;
  recoveryState: AdminOrderRecoveryState;
  vendorSummaries: AdminVendorOrderSummary[];
  activeIssues: AdminOrderIssueSummary[];
  resolvedIssues: AdminOrderIssueSummary[];
  health: AdminOrderHealthState;
  vendorCount: number;
};

function vendorOperationalStatus(vo: AdminOrderDetail["vendorOrders"][number]): {
  key: AdminVendorOrderOperationalStatus;
  label: string;
  detail?: string;
  recoveryState: AdminOrderRecoveryState;
} {
  const recovered = isManuallyRecovered(vo, vo.statusHistory);
  if (vo.fulfillmentStatus === "cancelled") {
    return { key: "cancelled", label: "Cancelled", recoveryState: "none" };
  }
  if (vo.fulfillmentStatus === "completed") {
    if (recovered) {
      return {
        key: "recovered_manually",
        label: "Completed",
        detail: "Recovered manually after a routing issue",
        recoveryState: "recovered_manually",
      };
    }
    return { key: "completed", label: "Completed", recoveryState: "none" };
  }
  if (recovered) {
    const fulfill = fulfillmentStatusBadge(vo.fulfillmentStatus).label;
    return {
      key: "recovered_manually",
      label: fulfill === "Pending" ? "In progress" : fulfill,
      detail: "Recovered manually after a routing issue",
      recoveryState: "recovered_manually",
    };
  }
  if (vo.routingStatus === "failed" && vo.fulfillmentStatus === "pending") {
    return {
      key: "routing_failed",
      label: "Routing failed",
      detail: "Vendor has not received this order yet",
      recoveryState: "none",
    };
  }
  if (vo.fulfillmentStatus === "ready") {
    return { key: "ready", label: "Ready for pickup", recoveryState: "none" };
  }
  return {
    key: "in_progress",
    label: fulfillmentStatusBadge(vo.fulfillmentStatus).label,
    recoveryState: "none",
  };
}

function receivedLabel(vo: AdminOrderDetail["vendorOrders"][number]): string {
  if (vo.manuallyRecoveredAt) return "Confirmed manually";
  if (vo.routingStatus === "failed" && vo.fulfillmentStatus === "pending") {
    return "Not received — routing failed";
  }
  if (vo.routingStatus === "confirmed" || vo.fulfillmentStatus !== "pending") {
    return "Confirmed";
  }
  if (vo.routingStatus === "sent") return "Sent — awaiting confirmation";
  if (vo.routingStatus === "pending") return "Not yet — routing pending";
  return "Unknown";
}

export function buildAdminOrderOperationalSummary(input: {
  order: AdminOrderDetail;
  paymentSummary: AdminOrderPaymentSummary | null;
  routingAvailable: boolean;
}): AdminOrderOperationalSummary {
  const { order, paymentSummary, routingAvailable } = input;
  const shortRef = order.id.slice(-8).toUpperCase();

  const customerActive = order.issues.filter(
    (i) => i.submittedByRole === "customer" && isActiveOrderIssueStatus(i.status)
  );
  const systemActive = order.issues.filter(
    (i) => i.submittedByRole !== "customer" && isSystemIssueActive(i.status)
  );

  const vendorSummaries: AdminVendorOrderSummary[] = order.vendorOrders.map((vo) => {
    const exceptionType = getExceptionType(vo);
    const actionState = getAdminActionState(vo, routingAvailable);
    const status = vendorOperationalStatus(vo);
    const provider = providerLabel(vo);
    const historical =
      (vo.routingStatus === "failed" || vo.squareLastError || vo.deliverectLastError) &&
      status.recoveryState === "recovered_manually"
        ? {
            message: (vo.squareLastError ?? vo.deliverectLastError ?? null)?.slice(0, 240) ?? null,
            provider: provider.label,
            recoveredAt: vo.manuallyRecoveredAt?.toISOString() ?? null,
            recoveredBy: vo.manuallyRecoveredBy ?? null,
            recoveryNotes: vo.manualRecoveryNotes ?? null,
          }
        : null;

    return {
      vendorOrderId: vo.id,
      vendorName: vo.vendor.name,
      statusKey: status.key,
      statusLabel: status.label,
      statusDetail: status.detail,
      recoveryState: status.recoveryState,
      receivedLabel: receivedLabel(vo),
      fulfillmentLabel: fulfillmentStatusBadge(vo.fulfillmentStatus).label,
      paymentAllocationLabel: paymentAllocationLabel(paymentSummary, vo.id),
      providerLabel: provider.label,
      showRetry: actionState.showRetry,
      showManualRecovery: actionState.showManualRecovery,
      historicalRoutingFailure: historical,
      exceptionType,
    };
  });

  const activeVendorIssues: AdminOrderIssueSummary[] = [];
  const resolvedVendorIssues: AdminOrderIssueSummary[] = [];
  for (const vo of order.vendorOrders) {
    for (const issue of vo.issues ?? []) {
      const entry: AdminOrderIssueSummary = {
        id: issue.id,
        kind: "vendor_order_issue",
        type: issue.type,
        title:
          issue.type === "routing_failure"
            ? "Routing failure"
            : issue.type === "manual_recovery"
              ? "Manual recovery (legacy record)"
              : issue.type.replaceAll("_", " "),
        status: issue.status === "OPEN" ? "active" : "resolved",
        vendorName: vo.vendor.name,
        notes: issue.notes,
        createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : null,
        resolvedAt: issue.resolvedAt instanceof Date ? issue.resolvedAt.toISOString() : null,
      };
      // Legacy open manual_recovery is not actionable
      if (issue.type === "manual_recovery") {
        resolvedVendorIssues.push({ ...entry, status: "resolved" });
        continue;
      }
      if (issue.status === "OPEN") activeVendorIssues.push(entry);
      else resolvedVendorIssues.push(entry);
    }
  }

  const activeIssues: AdminOrderIssueSummary[] = [
    ...customerActive.map((i) => ({
      id: i.id,
      kind: "order_issue" as const,
      type: i.type,
      title: "Customer report",
      status: "active" as const,
      vendorName: i.vendorOrder?.vendor.name ?? null,
      notes: i.customerMessage ?? i.notes,
      createdAt: i.createdAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
    })),
    ...systemActive.map((i) => ({
      id: i.id,
      kind: "order_issue" as const,
      type: i.type,
      title: i.type.replaceAll("_", " "),
      status: "active" as const,
      notes: i.notes,
      createdAt: i.createdAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
    })),
    ...activeVendorIssues,
  ];

  const resolvedIssues: AdminOrderIssueSummary[] = [
    ...order.issues
      .filter((i) => !isActiveOrderIssueStatus(i.status) && !isSystemIssueActive(i.status))
      .map((i) => ({
        id: i.id,
        kind: "order_issue" as const,
        type: i.type,
        title: i.type.replaceAll("_", " "),
        status: "resolved" as const,
        vendorName: i.vendorOrder?.vendor.name ?? null,
        notes: i.notes,
        createdAt: i.createdAt.toISOString(),
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
      })),
    ...resolvedVendorIssues,
  ];

  const vendorRecoveryContexts = vendorSummaries
    .filter((v) => v.exceptionType != null)
    .map((v) => {
      const vo = order.vendorOrders.find((x) => x.id === v.vendorOrderId)!;
      return {
        vendorOrderId: v.vendorOrderId,
        vendorName: v.vendorName,
        exceptionType: v.exceptionType!,
        reason: getExceptionReason(vo, v.exceptionType!),
      };
    });

  const health = buildAdminOrderHealth({
    orderStatus: order.status,
    paymentRefundStatus: paymentSummary?.order.paymentRefundStatus ?? null,
    paymentSummary,
    customerSupportIssues: customerActive.map((i) => ({
      id: i.id,
      issueType: i.type,
      status: i.status,
      customerMessage: i.customerMessage,
      vendorName: i.vendorOrder?.vendor.name ?? null,
    })),
    vendorRecoveryContexts,
  });

  const anyRecovered = vendorSummaries.some((v) => v.recoveryState === "recovered_manually");
  const anyActiveRouting = vendorSummaries.some((v) => v.statusKey === "routing_failed");
  const allCompleted =
    order.vendorOrders.length > 0 &&
    order.vendorOrders.every((v) => v.fulfillmentStatus === "completed");
  const anyReady = order.vendorOrders.some((v) => v.fulfillmentStatus === "ready");
  const allCancelled =
    order.vendorOrders.length > 0 &&
    order.vendorOrders.every((v) => v.fulfillmentStatus === "cancelled");

  let overallStatus: AdminOrderOverallStatus = "in_progress";
  let statusLabel = "In progress";
  let statusDetail: string | undefined;

  if (order.status === "pending_payment") {
    overallStatus = "pending_payment";
    statusLabel = "Awaiting payment";
  } else if (order.status === "cancelled" || allCancelled) {
    overallStatus = "cancelled";
    statusLabel = "Cancelled";
  } else if (health.status === "attention" || anyActiveRouting) {
    overallStatus = "needs_attention";
    statusLabel = "Needs attention";
    statusDetail = health.title;
  } else if (order.status === "completed" || allCompleted) {
    overallStatus = "completed";
    statusLabel = "Completed";
    if (anyRecovered) {
      statusDetail = "Recovered manually after a routing issue";
    }
  } else if (anyReady && order.vendorOrders.every((v) => v.fulfillmentStatus === "ready" || v.fulfillmentStatus === "completed")) {
    overallStatus = "ready";
    statusLabel = "Ready for pickup";
    if (anyRecovered) statusDetail = "Recovered manually after a routing issue";
  } else if (anyRecovered) {
    overallStatus = "in_progress";
    statusLabel = "In progress";
    statusDetail = "Recovered manually after a routing issue";
  } else if (
    order.vendorOrders.some((v) => v.routingStatus === "pending" || v.routingStatus === "failed")
  ) {
    overallStatus = "routing";
    statusLabel = "Routing";
  }

  // Financial clawback-only attention without other ops issues still needs_attention
  if (
    overallStatus !== "needs_attention" &&
    orderHasUnresolvedClawback(paymentSummary) &&
    health.status === "attention"
  ) {
    overallStatus = "needs_attention";
    statusLabel = "Needs attention";
    statusDetail = health.title;
  }

  return {
    orderId: order.id,
    shortRef,
    overallStatus,
    statusLabel,
    statusDetail,
    needsAttention: health.status === "attention" || overallStatus === "needs_attention",
    activeIssueCount: activeIssues.length,
    recoveryState: anyRecovered ? "recovered_manually" : "none",
    vendorSummaries,
    activeIssues,
    resolvedIssues,
    health,
    vendorCount: order.vendorOrders.length,
  };
}
