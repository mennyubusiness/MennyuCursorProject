import { describe, expect, it } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";
import { evaluatePodPayoutAllocationTransferEligibility } from "./pod-payout-transfer-eligibility";

const readyConnect = {
  podPayoutStripeConnectedAccountId: "acct_pod",
  podPayoutStripeDetailsSubmitted: true,
  podPayoutStripePayoutsEnabled: true,
};

const vendorPaid = [
  {
    netVendorTransferCents: 800,
    payoutTransfer: { amountCents: 800, status: "paid" },
  },
];

const vendorPending = [
  {
    netVendorTransferCents: 800,
    payoutTransfer: { amountCents: 800, status: "pending" },
  },
];

describe("evaluatePodPayoutAllocationTransferEligibility", () => {
  it("marks allocation transferable after related vendor transfer is paid", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
      paymentAllocations: vendorPaid,
    });
    expect(result.transferable).toBe(true);
    expect(result.reason).toBe("eligible");
    expect(result.ensureDecision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.pending);
  });

  it("blocks while related vendor transfer is pending", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
      paymentAllocations: vendorPending,
    });
    expect(result.transferable).toBe(false);
    expect(result.reason).toBe("waiting_on_vendor_transfer");
    expect(result.ensureDecision).toBeNull();
  });

  it("blocks while related vendor transfer failed", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
      paymentAllocations: [
        { netVendorTransferCents: 800, payoutTransfer: { amountCents: 800, status: "failed" } },
      ],
    });
    expect(result.transferable).toBe(false);
    expect(result.reason).toBe("waiting_on_vendor_transfer");
  });

  it("treats existing pending transfer row as transferable when vendor is paid", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
      paymentAllocations: vendorPaid,
      existingTransferStatus: POD_PAYOUT_TRANSFER_STATUS.pending,
    });
    expect(result.transferable).toBe(true);
    expect(result.reason).toBe("eligible");
    expect(result.ensureDecision?.status).toBe(POD_PAYOUT_TRANSFER_STATUS.pending);
  });

  it("blocks existing pending transfer row while vendor transfer is still pending", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: readyConnect,
      paymentAllocations: vendorPending,
      existingTransferStatus: POD_PAYOUT_TRANSFER_STATUS.pending,
    });
    expect(result.transferable).toBe(false);
    expect(result.reason).toBe("waiting_on_vendor_transfer");
  });

  it("blocks connect-not-ready even when vendor is paid", () => {
    const result = evaluatePodPayoutAllocationTransferEligibility({
      allocationStatus: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      minimumPayoutCents: 0,
      paymentRefundStatus: "none",
      recipientConnect: {
        podPayoutStripeConnectedAccountId: "acct_pod",
        podPayoutStripeDetailsSubmitted: false,
        podPayoutStripePayoutsEnabled: false,
      },
      paymentAllocations: vendorPaid,
    });
    expect(result.transferable).toBe(false);
    expect(result.reason).toBe("connect_not_ready");
  });
});
