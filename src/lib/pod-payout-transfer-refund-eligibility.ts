/**
 * Refund-aware pod payout transfer eligibility (pure helpers).
 */

import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export const POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS = "cancelled_due_to_refund" as const;
export const POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON =
  "customer_refund_extinguished_obligation" as const;

export const POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS = "blocked_partial_refund_review" as const;
export const POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON = "partial_refund_manual_review" as const;

export function isPodPayoutCancelledDueToRefundTransfer(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS ||
    row.blockedReason === POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON
  );
}

export function isPodPayoutPartialRefundReviewTransfer(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS ||
    row.blockedReason === POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON
  );
}

/** True when a Connect transfer was sent (paid/submitted with or without tr_ id). */
export function isSentPodPayoutTransfer(row: {
  status: string;
  stripeTransferId?: string | null;
}): boolean {
  if (row.stripeTransferId?.trim()) return true;
  return (
    row.status === POD_PAYOUT_TRANSFER_STATUS.paid ||
    row.status === POD_PAYOUT_TRANSFER_STATUS.submitted
  );
}

/** Unsent rows that refund sync may cancel or block (never submitted/paid via Connect). */
export function isUnsentPodPayoutTransferForRefund(row: {
  status: string;
  blockedReason?: string | null;
  stripeTransferId?: string | null;
}): boolean {
  if (isSentPodPayoutTransfer(row)) return false;
  if (isPodPayoutCancelledDueToRefundTransfer(row)) return false;
  return true;
}

export function isPodPayoutTransferExecutionBlockedByRefund(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    isPodPayoutCancelledDueToRefundTransfer(row) ||
    isPodPayoutPartialRefundReviewTransfer(row)
  );
}

export type PaymentRefundStatusForPodTransfer = "none" | "pending" | "partial" | "full" | null | undefined;

export function resolvePodPayoutTransferRefundBlock(
  paymentRefundStatus: PaymentRefundStatusForPodTransfer
):
  | { block: false }
  | { block: true; status: typeof POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS; blockedReason: typeof POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON }
  | { block: true; status: typeof POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS; blockedReason: typeof POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON } {
  if (paymentRefundStatus === "full") {
    return {
      block: true,
      status: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS,
      blockedReason: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
    };
  }
  if (paymentRefundStatus === "partial" || paymentRefundStatus === "pending") {
    return {
      block: true,
      status: POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS,
      blockedReason: POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
    };
  }
  return { block: false };
}
