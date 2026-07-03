import { describe, expect, it } from "vitest";
import {
  isReconcilablePodPayoutTransfer,
  podMetadataStrongMatch,
  podReconciliationResultMessage,
  stripeTransferMatchesPodPayoutRow,
} from "./pod-payout-transfer-reconciliation";
import { POD_PAYOUT_TRANSFER_STATUS } from "./pod-payout-transfer-decision";

const row = {
  id: "ppt_1",
  podPayoutAllocationId: "ppa_1",
  podId: "pod_1",
  orderId: "ord_1",
  destinationAccountId: "acct_pod",
  amountCents: 500,
  currency: "usd",
  status: POD_PAYOUT_TRANSFER_STATUS.failed,
  stripeTransferId: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  submittedAt: null,
  paidAt: null,
  failedAt: new Date("2026-06-01T12:05:00.000Z"),
};

describe("pod payout transfer reconciliation helpers", () => {
  it("allows reconcile for failed rows without stripeTransferId", () => {
    expect(isReconcilablePodPayoutTransfer(row)).toBe(true);
  });

  it("rejects paid rows that already have stripeTransferId", () => {
    expect(
      isReconcilablePodPayoutTransfer({
        ...row,
        status: POD_PAYOUT_TRANSFER_STATUS.paid,
        stripeTransferId: "tr_123",
      })
    ).toBe(false);
  });

  it("matches stripe transfer metadata to pod row", () => {
    expect(
      podMetadataStrongMatch(
        { openOrderPodPayoutTransferId: "ppt_1" },
        row
      )
    ).toBe(true);
    expect(
      stripeTransferMatchesPodPayoutRow(
        {
          id: "tr_1",
          amount: 500,
          currency: "usd",
          destination: "acct_pod",
          reversed: false,
          created: Math.floor(new Date("2026-06-01T12:10:00.000Z").getTime() / 1000),
          metadata: { openOrderPodPayoutTransferId: "ppt_1" },
        },
        row,
        { gte: 0, lte: Math.floor(Date.now() / 1000) + 86400 }
      ).matches
    ).toBe(true);
  });

  it("returns user-facing reconcile messages", () => {
    expect(podReconciliationResultMessage("unchanged_not_found")).toBe(
      "No matching Stripe transfer found."
    );
  });
});
