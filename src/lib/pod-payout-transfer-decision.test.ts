import { describe, expect, it } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  blockedReasonForPodPayoutConnect,
  isPodPayoutConnectTransferReady,
  POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION,
  POD_PAYOUT_TRANSFER_STATUS,
  resolvePodPayoutTransferEnsureDecision,
  stablePodPayoutTransferIdempotencyKey,
} from "@/lib/pod-payout-transfer-decision";

const readyConnect = {
  podPayoutStripeConnectedAccountId: "acct_pod_ready",
  podPayoutStripeDetailsSubmitted: true,
  podPayoutStripePayoutsEnabled: true,
};

describe("stablePodPayoutTransferIdempotencyKey", () => {
  it("uses openorder_ppt prefix", () => {
    expect(stablePodPayoutTransferIdempotencyKey("ppa_123")).toBe("openorder_ppt_ppa_123");
  });
});

describe("isPodPayoutConnectTransferReady", () => {
  it("requires account id, details submitted, and payouts enabled", () => {
    expect(isPodPayoutConnectTransferReady(readyConnect)).toBe(true);
    expect(
      isPodPayoutConnectTransferReady({
        ...readyConnect,
        podPayoutStripeDetailsSubmitted: false,
      })
    ).toBe(false);
    expect(
      isPodPayoutConnectTransferReady({
        ...readyConnect,
        podPayoutStripePayoutsEnabled: false,
      })
    ).toBe(false);
  });
});

describe("resolvePodPayoutTransferEnsureDecision", () => {
  it("returns null for non-pending allocations", () => {
    expect(
      resolvePodPayoutTransferEnsureDecision({
        allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.blocked,
        podPayoutAmountCents: 500,
        minimumPayoutCents: 0,
        paymentRefundStatus: "none",
        recipientConnect: readyConnect,
      })
    ).toBeNull();
  });

  it("creates pending row when eligible", () => {
    const decision = resolvePodPayoutTransferEnsureDecision({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 500,
      minimumPayoutCents: 100,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
    });
    expect(decision).toEqual({
      status: POD_PAYOUT_TRANSFER_STATUS.pending,
      destinationAccountId: "acct_pod_ready",
      amountCents: 500,
      blockedReason: null,
    });
  });

  it("blocks connect not ready", () => {
    const decision = resolvePodPayoutTransferEnsureDecision({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 500,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: {
        podPayoutStripeConnectedAccountId: "acct_1",
        podPayoutStripeDetailsSubmitted: false,
        podPayoutStripePayoutsEnabled: false,
      },
    });
    expect(decision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady);
    expect(decision?.destinationAccountId).toBe(POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION);
    expect(decision?.blockedReason).toBe("stripe_details_not_submitted");
  });

  it("blocks below minimum payout", () => {
    const decision = resolvePodPayoutTransferEnsureDecision({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 50,
      minimumPayoutCents: 100,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
    });
    expect(decision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum);
  });

  it("cancels on full refund", () => {
    const decision = resolvePodPayoutTransferEnsureDecision({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 500,
      minimumPayoutCents: 0,
      paymentRefundStatus: "full",
      recipientConnect: readyConnect,
    });
    expect(decision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund);
  });

  it("blocks partial or pending refunds", () => {
    for (const paymentRefundStatus of ["partial", "pending"] as const) {
      const decision = resolvePodPayoutTransferEnsureDecision({
        allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
        podPayoutAmountCents: 500,
        minimumPayoutCents: 0,
        paymentRefundStatus,
        recipientConnect: readyConnect,
      });
      expect(decision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview);
    }
  });
});
