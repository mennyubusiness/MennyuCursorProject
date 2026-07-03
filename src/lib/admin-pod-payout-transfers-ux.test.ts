import { describe, expect, it } from "vitest";
import {
  formatRevenueShareBps,
  isReconcilablePodPayoutTransferRow,
  isRetryablePodPayoutTransfer,
  podTransferIsBlocked,
  podTransferMatchesQuickFilter,
  podTransferNeedsAction,
} from "./admin-pod-payout-transfers-ux";
import { POD_PAYOUT_TRANSFER_STATUS } from "./pod-payout-transfer-decision";

const baseRow = {
  id: "ppt-1",
  podId: "pod-1",
  podName: "Test Pod",
  status: POD_PAYOUT_TRANSFER_STATUS.pending,
  amountCents: 500,
  createdAt: "2026-01-01T00:00:00.000Z",
  blockedReason: null,
  blockedReasonLabel: null,
  failureMessage: null,
  destinationAccountId: "acct_123",
};

describe("admin-pod-payout-transfers-ux", () => {
  it("treats pending pod transfers as needing action", () => {
    expect(podTransferNeedsAction(baseRow)).toBe(true);
    expect(podTransferMatchesQuickFilter(baseRow, "needs_action")).toBe(true);
    expect(podTransferMatchesQuickFilter(baseRow, "ready")).toBe(true);
  });

  it("treats paid pod transfers as sent history", () => {
    const paid = { ...baseRow, status: POD_PAYOUT_TRANSFER_STATUS.paid };
    expect(podTransferNeedsAction(paid)).toBe(false);
    expect(podTransferMatchesQuickFilter(paid, "sent")).toBe(true);
    expect(podTransferMatchesQuickFilter(paid, "needs_action")).toBe(false);
  });

  it("classifies blocked connect and refund review states", () => {
    const blocked = {
      ...baseRow,
      status: POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
      destinationAccountId: "blocked",
    };
    expect(podTransferIsBlocked(blocked)).toBe(true);
    expect(podTransferMatchesQuickFilter(blocked, "blocked")).toBe(true);
  });

  it("formats revenue share bps for admin display", () => {
    expect(formatRevenueShareBps(500)).toBe("5%");
    expect(formatRevenueShareBps(125)).toBe("1.25%");
  });

  it("allows retry only for failed and balance-blocked pod rows", () => {
    expect(
      isRetryablePodPayoutTransfer({
        ...baseRow,
        status: POD_PAYOUT_TRANSFER_STATUS.failed,
      })
    ).toBe(true);
    expect(
      isRetryablePodPayoutTransfer({
        ...baseRow,
        status: POD_PAYOUT_TRANSFER_STATUS.pending,
      })
    ).toBe(false);
    expect(
      isRetryablePodPayoutTransfer({
        ...baseRow,
        status: POD_PAYOUT_TRANSFER_STATUS.paid,
        stripeTransferId: "tr_1",
      })
    ).toBe(false);
    expect(
      isRetryablePodPayoutTransfer({
        ...baseRow,
        status: POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
      })
    ).toBe(false);
  });

  it("allows reconcile for failed rows without stripe transfer id", () => {
    expect(
      isReconcilablePodPayoutTransferRow({
        ...baseRow,
        status: POD_PAYOUT_TRANSFER_STATUS.failed,
      })
    ).toBe(true);
  });
});
