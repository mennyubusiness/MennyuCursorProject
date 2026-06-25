/**
 * Pure refund sync decisions for pod payout allocations and transfers.
 */
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  isPodPayoutAllocationCancelledDueToRefund,
  isPodPayoutAllocationPostTransferRefundReview,
  isPodPayoutAllocationRefundReviewBlocked,
  POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
  POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
  POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON,
  POD_PAYOUT_CANCELLED_DUE_TO_REFUND_ADMIN_NOTE,
  POD_PAYOUT_PARTIAL_REFUND_REVIEW_DISPLAY,
  POD_PAYOUT_POST_TRANSFER_REFUND_REVIEW_DISPLAY,
} from "@/lib/pod-payout-refund-eligibility.constants";
import {
  isPodPayoutCancelledDueToRefundTransfer,
  isPodPayoutPartialRefundReviewTransfer,
  isSentPodPayoutTransfer,
  isUnsentPodPayoutTransferForRefund,
  POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
  POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
  POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS,
  POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS,
  type PaymentRefundStatusForPodTransfer,
} from "@/lib/pod-payout-transfer-refund-eligibility";

export type PodPayoutRefundSyncRow = {
  status: string;
  blockedReason?: string | null;
  stripeTransferId?: string | null;
};

export type PodPayoutRefundSyncDecision =
  | { action: "noop" }
  | {
      action: "cancel";
      allocationStatus: typeof POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund;
      allocationBlockedReason: typeof POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON;
      allocationFailureMessage: string;
      transferStatus: typeof POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS;
      transferBlockedReason: typeof POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON;
      transferFailureMessage: string;
      updateTransfer: boolean;
    }
  | {
      action: "block_review";
      allocationStatus: typeof POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview;
      allocationBlockedReason: typeof POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON;
      allocationFailureMessage: string;
      transferStatus: typeof POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS;
      transferBlockedReason: typeof POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON;
      transferFailureMessage: string;
      updateTransfer: boolean;
    }
  | {
      action: "post_transfer_review";
      allocationStatus: typeof POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview;
      allocationBlockedReason: typeof POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON;
      allocationFailureMessage: string;
      updateTransfer: false;
    };

function isRefundActive(paymentRefundStatus: PaymentRefundStatusForPodTransfer): boolean {
  return (
    paymentRefundStatus === "full" ||
    paymentRefundStatus === "partial" ||
    paymentRefundStatus === "pending"
  );
}

/**
 * Decide how pod payout allocation (and optional transfer) should react to order refund state.
 */
export function resolvePodPayoutRefundSyncDecision(input: {
  allocation: PodPayoutRefundSyncRow;
  transfer: PodPayoutRefundSyncRow | null;
  paymentRefundStatus: PaymentRefundStatusForPodTransfer;
}): PodPayoutRefundSyncDecision {
  const { allocation, transfer, paymentRefundStatus } = input;

  if (!isRefundActive(paymentRefundStatus)) {
    return { action: "noop" };
  }

  if (isPodPayoutAllocationCancelledDueToRefund(allocation)) {
    if (!transfer || isPodPayoutCancelledDueToRefundTransfer(transfer)) {
      return { action: "noop" };
    }
  }

  if (isPodPayoutAllocationPostTransferRefundReview(allocation)) {
    return { action: "noop" };
  }

  if (
    isPodPayoutAllocationRefundReviewBlocked(allocation) &&
    !isSentPodPayoutTransfer(transfer ?? { status: "pending", stripeTransferId: null })
  ) {
    if (
      !transfer ||
      isPodPayoutPartialRefundReviewTransfer(transfer) ||
      isPodPayoutCancelledDueToRefundTransfer(transfer)
    ) {
      return { action: "noop" };
    }
  }

  const transferSent = transfer ? isSentPodPayoutTransfer(transfer) : false;

  if (transferSent) {
    if (isPodPayoutAllocationRefundReviewBlocked(allocation)) {
      return { action: "noop" };
    }
    return {
      action: "post_transfer_review",
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
      allocationBlockedReason: POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON,
      allocationFailureMessage: POD_PAYOUT_POST_TRANSFER_REFUND_REVIEW_DISPLAY,
      updateTransfer: false,
    };
  }

  if (paymentRefundStatus === "full") {
    const updateTransfer = Boolean(transfer && isUnsentPodPayoutTransferForRefund(transfer));
    return {
      action: "cancel",
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund,
      allocationBlockedReason: POD_PAYOUT_ALLOCATION_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
      allocationFailureMessage: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_ADMIN_NOTE,
      transferStatus: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS,
      transferBlockedReason: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
      transferFailureMessage: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_ADMIN_NOTE,
      updateTransfer,
    };
  }

  const updateTransfer = Boolean(transfer && isUnsentPodPayoutTransferForRefund(transfer));
  return {
    action: "block_review",
    allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
    allocationBlockedReason: POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
    allocationFailureMessage: POD_PAYOUT_PARTIAL_REFUND_REVIEW_DISPLAY,
    transferStatus: POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS,
    transferBlockedReason: POD_PAYOUT_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
    transferFailureMessage: POD_PAYOUT_PARTIAL_REFUND_REVIEW_DISPLAY,
    updateTransfer,
  };
}
