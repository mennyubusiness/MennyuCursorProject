import { describe, expect, it } from "vitest";
import { computePodPayoutGlobalSummary } from "@/services/admin-pod-payout-transfer-list.service";
import type { AdminPodPayoutTransferRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

function row(
  partial: Partial<AdminPodPayoutTransferRow> & Pick<AdminPodPayoutTransferRow, "status" | "amountCents">
): AdminPodPayoutTransferRow {
  return {
    id: "ppt-1",
    podId: "pod-1",
    podName: "Pod",
    orderId: "ord-1",
    currency: "usd",
    destinationAccountId: "acct",
    statusLabel: partial.status,
    stripeTransferId: null,
    blockedReason: null,
    blockedReasonLabel: null,
    failureMessage: null,
    batchKey: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    submittedAt: null,
    paidAt: null,
    revenueShareBps: 500,
    recipientEmail: "owner@example.com",
    recipientUserId: "user-1",
    ...partial,
  };
}

describe("computePodPayoutGlobalSummary", () => {
  it("aggregates ready, blocked, and paid pod transfer totals", () => {
    const summary = computePodPayoutGlobalSummary([
      row({ status: POD_PAYOUT_TRANSFER_STATUS.pending, amountCents: 1000 }),
      row({ id: "ppt-2", status: POD_PAYOUT_TRANSFER_STATUS.failed, amountCents: 200 }),
      row({ id: "ppt-3", status: POD_PAYOUT_TRANSFER_STATUS.paid, amountCents: 3000 }),
      row({
        id: "ppt-4",
        status: POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund,
        amountCents: 999,
      }),
    ]);

    expect(summary.readyToTransferCount).toBe(1);
    expect(summary.readyToTransferAmountCents).toBe(1000);
    expect(summary.blockedCount).toBe(1);
    expect(summary.blockedAmountCents).toBe(200);
    expect(summary.paidCount).toBe(1);
    expect(summary.paidAmountCents).toBe(3000);
    expect(summary.needsActionCount).toBe(2);
    expect(summary.needsActionAmountCents).toBe(1200);
  });
});
