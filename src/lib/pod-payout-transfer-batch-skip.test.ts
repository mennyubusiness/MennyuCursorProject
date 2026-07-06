import { describe, expect, it } from "vitest";
import {
  createEmptyPodPayoutTransferSkipReasonCounts,
  formatPodPayoutTransferBatchResultMessage,
  formatPodPayoutTransferBatchSkipSummary,
  normalizePodPayoutTransferSkipReason,
} from "@/lib/pod-payout-transfer-batch-skip";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

describe("normalizePodPayoutTransferSkipReason", () => {
  it("maps vendor gate and connect failures to admin labels", () => {
    expect(normalizePodPayoutTransferSkipReason("waiting_on_vendor_transfer")).toBe(
      "waiting_on_vendor_transfer"
    );
    expect(normalizePodPayoutTransferSkipReason(POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady)).toBe(
      "connect_not_ready"
    );
    expect(normalizePodPayoutTransferSkipReason(POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview)).toBe(
      "refund_review"
    );
    expect(normalizePodPayoutTransferSkipReason(POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance)).toBe(
      "insufficient_balance"
    );
    expect(normalizePodPayoutTransferSkipReason("allocation_not_pending")).toBe("not_pending");
    expect(normalizePodPayoutTransferSkipReason("mystery_reason")).toBe("unknown_skip");
  });
});

describe("formatPodPayoutTransferBatchSkipSummary", () => {
  it("includes only non-zero skip reason counts", () => {
    const counts = createEmptyPodPayoutTransferSkipReasonCounts();
    counts.not_pending = 7;
    expect(formatPodPayoutTransferBatchSkipSummary({ skipReasonCounts: counts })).toBe(
      "Transfer row not pending: 7"
    );
  });
});

describe("formatPodPayoutTransferBatchResultMessage", () => {
  it("appends skip reason counts to batch result message", () => {
    const counts = createEmptyPodPayoutTransferSkipReasonCounts();
    counts.not_pending = 7;
    const message = formatPodPayoutTransferBatchResultMessage({
      batchKey: "pod-test-2026-07-06",
      rowsCreated: 0,
      examined: 7,
      settled: 0,
      skipped: 7,
      failed: 0,
      blockedInsufficientBalance: 0,
      stoppedEarlyForBalance: false,
      skipReasonCounts: counts,
    });
    expect(message).toContain("skipped 7");
    expect(message).toContain("Skip reasons: Transfer row not pending: 7");
  });
});
