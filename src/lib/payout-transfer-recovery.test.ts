import { describe, expect, it } from "vitest";
import {
  BLOCKING_POD_PAYOUT_TRANSFER_STATUSES,
  BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES,
  isBlockingPodPayoutTransferStatus,
  isBlockingVendorPayoutTransferStatus,
  isPodReEvaluateSkippedTerminal,
  isVendorReEvaluateSkippedTerminal,
} from "./payout-transfer-recovery";
import { POD_PAYOUT_TRANSFER_STATUS } from "./pod-payout-transfer-decision";

describe("payout-transfer-recovery constants", () => {
  it("blocks vendor deletion for failed and refund-review transfers", () => {
    expect(isBlockingVendorPayoutTransferStatus("failed")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("blocked_insufficient_balance")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("blocked_partial_refund_review")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("blocked_idempotency_mismatch")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("paid")).toBe(false);
    expect(isBlockingVendorPayoutTransferStatus("cancelled_due_to_refund")).toBe(false);
    expect(BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES).toContain("failed");
  });

  it("blocks pod deletion for recoverable problem states", () => {
    expect(isBlockingPodPayoutTransferStatus(POD_PAYOUT_TRANSFER_STATUS.failed)).toBe(true);
    expect(isBlockingPodPayoutTransferStatus(POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance)).toBe(
      true
    );
    expect(isBlockingPodPayoutTransferStatus(POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch)).toBe(
      true
    );
    expect(isBlockingPodPayoutTransferStatus(POD_PAYOUT_TRANSFER_STATUS.paid)).toBe(false);
    expect(isBlockingPodPayoutTransferStatus(POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund)).toBe(false);
    expect(BLOCKING_POD_PAYOUT_TRANSFER_STATUSES).toContain(
      POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady
    );
  });

  it("skips terminal vendor rows during re-evaluation", () => {
    expect(isVendorReEvaluateSkippedTerminal("failed")).toBe(true);
    expect(isVendorReEvaluateSkippedTerminal("blocked_partial_refund_review")).toBe(true);
    expect(isVendorReEvaluateSkippedTerminal("blocked")).toBe(false);
  });

  it("skips terminal pod rows during re-evaluation", () => {
    expect(isPodReEvaluateSkippedTerminal(POD_PAYOUT_TRANSFER_STATUS.failed)).toBe(true);
    expect(isPodReEvaluateSkippedTerminal(POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview)).toBe(
      true
    );
    expect(isPodReEvaluateSkippedTerminal(POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady)).toBe(false);
  });
});
