/**
 * Authoritative admin “needs attention” derivation from tracked issues.
 *
 * Operational unresolved state is driven by active VendorOrderIssue / OrderIssue rows —
 * not by historical routingStatus, fulfillment cancellation, or refund records alone.
 */

import { isActiveOrderIssueStatus } from "@/domain/order-support-issue";
import { isSystemIssueActive } from "@/lib/admin-order-detail-ui";
import { NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES } from "@/services/issues.service";

export type AdminOrderIssueAttentionKind =
  | "hasActiveIssues"
  | "hasResolvedIssueHistory"
  | "noIssues";

export type VendorOrderIssueAttentionInput = {
  status: string;
  type: string;
};

export type OrderIssueAttentionInput = {
  status: string;
  /** When set, customer issues use active OrderIssue statuses; others use system OPEN. */
  submittedByRole?: string | null;
  type?: string;
};

export type AdminOrderIssueAttention = {
  kind: AdminOrderIssueAttentionKind;
  /** True when at least one actionable issue is still open/unresolved. */
  hasActiveIssues: boolean;
  /** True when there is resolved (or legacy non-actionable) issue history. */
  hasResolvedIssueHistory: boolean;
  activeCount: number;
  resolvedCount: number;
};

export function isActionableOpenVendorOrderIssue(
  issue: VendorOrderIssueAttentionInput
): boolean {
  if (NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES.includes(issue.type as never)) {
    return false;
  }
  const s = issue.status.trim();
  return s === "OPEN" || s.toLowerCase() === "open";
}

export function isResolvedOrNonActionableVendorOrderIssue(
  issue: VendorOrderIssueAttentionInput
): boolean {
  if (NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES.includes(issue.type as never)) {
    return true;
  }
  if (isActionableOpenVendorOrderIssue(issue)) return false;
  const s = issue.status.trim().toLowerCase();
  return s === "resolved" || issue.status === "RESOLVED" || s === "dismissed";
}

function isActiveOrderIssueRow(issue: OrderIssueAttentionInput): boolean {
  if (issue.submittedByRole === "customer") {
    return isActiveOrderIssueStatus(issue.status);
  }
  return isSystemIssueActive(issue.status) || isActiveOrderIssueStatus(issue.status);
}

/**
 * Single source of truth for whether an order is operationally unresolved in admin UI.
 *
 * needsAttention ≡ hasActiveIssues
 *   (exists an actionable unresolved VendorOrderIssue, or an active OrderIssue)
 */
export function deriveAdminOrderIssueAttention(input: {
  vendorOrderIssues?: VendorOrderIssueAttentionInput[] | null;
  orderIssues?: OrderIssueAttentionInput[] | null;
}): AdminOrderIssueAttention {
  const vendorIssues = input.vendorOrderIssues ?? [];
  const orderIssues = input.orderIssues ?? [];

  const activeVendor = vendorIssues.filter(isActionableOpenVendorOrderIssue);
  const activeOrder = orderIssues.filter(isActiveOrderIssueRow);
  const activeCount = activeVendor.length + activeOrder.length;

  const resolvedVendor = vendorIssues.filter(isResolvedOrNonActionableVendorOrderIssue);
  const resolvedOrder = orderIssues.filter((i) => !isActiveOrderIssueRow(i));
  const resolvedCount = resolvedVendor.length + resolvedOrder.length;

  const hasActiveIssues = activeCount > 0;
  const hasResolvedIssueHistory = resolvedCount > 0;

  let kind: AdminOrderIssueAttentionKind = "noIssues";
  if (hasActiveIssues) kind = "hasActiveIssues";
  else if (hasResolvedIssueHistory) kind = "hasResolvedIssueHistory";

  return {
    kind,
    hasActiveIssues,
    hasResolvedIssueHistory,
    activeCount,
    resolvedCount,
  };
}

/** Convenience: order requires admin attention iff it has active tracked issues. */
export function orderNeedsAdminAttentionFromIssues(input: {
  vendorOrderIssues?: VendorOrderIssueAttentionInput[] | null;
  orderIssues?: OrderIssueAttentionInput[] | null;
}): boolean {
  return deriveAdminOrderIssueAttention(input).hasActiveIssues;
}

/**
 * Historical multi-vendor failure copy (facts only — does not imply Needs attention).
 * Counts vendor orders that still carry routingStatus=failed (including cancelled/refunded).
 */
export function historicalFailedVendorReceiveDetail(
  vendorOrders: Array<{ routingStatus: string }>,
  options?: { resolved?: boolean }
): string | undefined {
  const total = vendorOrders.length;
  if (total === 0) return undefined;
  const failed = vendorOrders.filter((vo) => vo.routingStatus === "failed").length;
  if (failed === 0) return undefined;
  const base = `${failed} of ${total} vendors failed to receive the order`;
  return options?.resolved ? `${base} (handled)` : base;
}
