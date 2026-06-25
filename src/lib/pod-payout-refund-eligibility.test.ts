import { describe, expect, it } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import { resolvePodPayoutRefundSyncDecision } from "@/lib/pod-payout-refund-eligibility";
import {
  POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON,
  POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
} from "@/lib/pod-payout-refund-eligibility.constants";
import {
  isSentPodPayoutTransfer,
  isUnsentPodPayoutTransferForRefund,
  POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS,
  POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS,
} from "@/lib/pod-payout-transfer-refund-eligibility";

const pendingAllocation = { status: POD_PAYOUT_ALLOCATION_STATUS.pending, blockedReason: null };
const pendingTransfer = { status: "pending", blockedReason: null, stripeTransferId: null };
const paidTransfer = { status: "paid", blockedReason: null, stripeTransferId: "tr_pod_1" };

describe("pod payout transfer refund helpers", () => {
  it("treats paid and submitted transfers as sent", () => {
    expect(isSentPodPayoutTransfer({ status: "paid", stripeTransferId: "tr_1" })).toBe(true);
    expect(isSentPodPayoutTransfer({ status: "submitted", stripeTransferId: null })).toBe(true);
    expect(isUnsentPodPayoutTransferForRefund({ status: "pending", stripeTransferId: null })).toBe(
      true
    );
    expect(
      isUnsentPodPayoutTransferForRefund({ status: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS })
    ).toBe(false);
  });
});

describe("resolvePodPayoutRefundSyncDecision", () => {
  it("returns noop when no refund on order", () => {
    expect(
      resolvePodPayoutRefundSyncDecision({
        allocation: pendingAllocation,
        transfer: pendingTransfer,
        paymentRefundStatus: "none",
      })
    ).toEqual({ action: "noop" });
  });

  it("cancels allocation and unsent transfer on full refund before transfer", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: pendingTransfer,
      paymentRefundStatus: "full",
    });
    expect(decision.action).toBe("cancel");
    if (decision.action === "cancel") {
      expect(decision.allocationStatus).toBe(POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund);
      expect(decision.transferStatus).toBe(POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS);
      expect(decision.updateTransfer).toBe(true);
    }
  });

  it("cancels allocation when full refund and no transfer row", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: null,
      paymentRefundStatus: "full",
    });
    expect(decision.action).toBe("cancel");
    if (decision.action === "cancel") {
      expect(decision.updateTransfer).toBe(false);
    }
  });

  it("blocks allocation and unsent transfer on partial refund before transfer", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: pendingTransfer,
      paymentRefundStatus: "partial",
    });
    expect(decision.action).toBe("block_review");
    if (decision.action === "block_review") {
      expect(decision.allocationStatus).toBe(POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview);
      expect(decision.transferStatus).toBe(POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS);
      expect(decision.updateTransfer).toBe(true);
    }
  });

  it("blocks on pending refund before transfer", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: pendingTransfer,
      paymentRefundStatus: "pending",
    });
    expect(decision.action).toBe("block_review");
  });

  it("marks post-transfer review without changing sent transfer on full refund after transfer", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: paidTransfer,
      paymentRefundStatus: "full",
    });
    expect(decision).toEqual({
      action: "post_transfer_review",
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
      allocationBlockedReason: POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON,
      allocationFailureMessage: expect.stringContaining("Refund occurred after pod payout transfer"),
      updateTransfer: false,
    });
  });

  it("marks post-transfer review on partial refund after transfer", () => {
    const decision = resolvePodPayoutRefundSyncDecision({
      allocation: pendingAllocation,
      transfer: paidTransfer,
      paymentRefundStatus: "partial",
    });
    expect(decision.action).toBe("post_transfer_review");
    if (decision.action === "post_transfer_review") {
      expect(decision.updateTransfer).toBe(false);
    }
  });

  it("is idempotent when allocation already cancelled", () => {
    expect(
      resolvePodPayoutRefundSyncDecision({
        allocation: {
          status: POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund,
          blockedReason: "customer_refund_extinguished_obligation",
        },
        transfer: {
          status: POD_PAYOUT_CANCELLED_DUE_TO_REFUND_STATUS,
          blockedReason: "customer_refund_extinguished_obligation",
          stripeTransferId: null,
        },
        paymentRefundStatus: "full",
      })
    ).toEqual({ action: "noop" });
  });

  it("is idempotent when already blocked for partial refund review", () => {
    expect(
      resolvePodPayoutRefundSyncDecision({
        allocation: {
          status: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
          blockedReason: POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
        },
        transfer: {
          status: POD_PAYOUT_PARTIAL_REFUND_REVIEW_STATUS,
          blockedReason: POD_PAYOUT_ALLOCATION_PARTIAL_REFUND_REVIEW_BLOCKED_REASON,
          stripeTransferId: null,
        },
        paymentRefundStatus: "partial",
      })
    ).toEqual({ action: "noop" });
  });

  it("is idempotent when post-transfer review already recorded", () => {
    expect(
      resolvePodPayoutRefundSyncDecision({
        allocation: {
          status: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
          blockedReason: POD_PAYOUT_ALLOCATION_POST_TRANSFER_REFUND_REVIEW_BLOCKED_REASON,
        },
        transfer: paidTransfer,
        paymentRefundStatus: "full",
      })
    ).toEqual({ action: "noop" });
  });
});
