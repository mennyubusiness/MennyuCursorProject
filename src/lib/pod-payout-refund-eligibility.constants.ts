/**
 * Shared pod payout refund sync labels and allocation-side blocked reasons.
 */
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";

export const POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON =
  "customer_refund_extinguished_obligation" as const;
export const POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON =
  "partial_refund_manual_review" as const;
export const POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON =
  "post_transfer_refund_review" as const;

export const POD_PAYOUT_CANCELLED_DUE_TO_REFUND_ADMIN_NOTE =
  "Customer refund extinguished this pod payout obligation. No transfer should be sent.";
export const POD_PAYOUT_PARTIAL_REFUND_REVIEW_DISPLAY =
  "Partial or pending customer refund on this order. Manual review required before any pod payout transfer.";
export const POD_PAYOUT_POST_TRANSFER_REFUND_REVIEW_DISPLAY =
  "Refund occurred after pod payout transfer. Review manually.";

export const POD_PAYOUT_ALLOCATION_REFUND_BLOCKED_REASON_LABELS: Record<string, string> = {
  [POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON]: "Customer refund — pod payout no longer payable",
  [POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON]:
    "Partial or pending refund — admin review required before transfer",
  [POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON]:
    "Refund occurred after pod payout transfer — review manually",
};

export function isPodPayoutAllocationCancelledDueToRefund(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund ||
    row.blockedReason === POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON
  );
}

export function isPodPayoutAllocationPostTransferRefundReview(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview &&
    row.blockedReason === POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON
  );
}

export function isPodPayoutAllocationRefundReviewBlocked(row: {
  status: string;
  blockedReason?: string | null;
}): boolean {
  return (
    row.status === POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview ||
    row.blockedReason === POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON ||
    row.blockedReason === POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON
  );
}

export function podPayoutAllocationRefundStatusLabel(status: string, blockedReason: string | null): string {
  if (status === POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund) {
    return "Cancelled after refund";
  }
  if (status === POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview) {
    if (blockedReason === POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON) {
      return "Needs review (refund after transfer)";
    }
    return "Needs review";
  }
  switch (status) {
    case POD_PAYOUT_ALLOCATION_STATUS.pending:
      return "Pending";
    case POD_PAYOUT_ALLOCATION_STATUS.paid:
      return "Paid";
    case POD_PAYOUT_ALLOCATION_STATUS.blocked:
      return "Blocked";
    default:
      return status;
  }
}

export function podPayoutAllocationRefundBlockedReasonLabel(blockedReason: string | null): string | null {
  if (!blockedReason) return null;
  return POD_PAYOUT_ALLOCATION_REFUND_BLOCKED_REASON_LABELS[blockedReason] ?? blockedReason;
}
