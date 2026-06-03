/**
 * Refund-aware vendor Connect transfer eligibility (pure helpers).
 */

export const CANCELLED_DUE_TO_REFUND_STATUS = "cancelled_due_to_refund" as const;
export const CANCELLED_DUE_TO_REFUND_BLOCKED_REASON =
  "customer_refund_extinguished_obligation" as const;
export const CANCELLED_DUE_TO_REFUND_DISPLAY =
  "Customer refund extinguished this vendor transfer obligation. No Connect transfer should be sent.";
export const CANCELLED_DUE_TO_REFUND_ADMIN_NOTE =
  "Customer refunded — vendor transfer no longer payable";

export const PARTIAL_REFUND_MANUAL_REVIEW_STATUS = "blocked_partial_refund_review" as const;
export const PARTIAL_REFUND_MANUAL_REVIEW_BLOCKED_REASON = "partial_refund_manual_review" as const;
export const PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY =
  "Partial customer refund on this vendor order. Manual review required before any vendor Connect transfer.";

export function isCancelledDueToRefundTransfer(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === CANCELLED_DUE_TO_REFUND_STATUS ||
    row.blockedReason === CANCELLED_DUE_TO_REFUND_BLOCKED_REASON
  );
}

export function isPartialRefundManualReviewTransfer(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === PARTIAL_REFUND_MANUAL_REVIEW_STATUS ||
    row.blockedReason === PARTIAL_REFUND_MANUAL_REVIEW_BLOCKED_REASON
  );
}

/** True when a Connect transfer was sent (paid with tr_ id). */
export function isPaidVendorConnectTransfer(row: {
  status: string;
  stripeTransferId?: string | null;
}): boolean {
  return row.status === "paid" && Boolean(row.stripeTransferId?.trim());
}

/** Unsent rows that refund logic may cancel or block (never paid via Connect). */
export function isUnsentVendorPayoutTransferForRefund(row: {
  status: string;
  stripeTransferId?: string | null;
}): boolean {
  if (isPaidVendorConnectTransfer(row)) return false;
  if (row.stripeTransferId?.trim()) return false;
  if (isCancelledDueToRefundTransfer(row)) return false;
  return true;
}

export function isVendorTransferExecutionBlockedByRefund(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    isCancelledDueToRefundTransfer(row) ||
    isPartialRefundManualReviewTransfer(row)
  );
}
