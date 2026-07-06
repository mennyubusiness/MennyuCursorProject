import { describe, expect, it } from "vitest";
import {
  aggregatePodPayoutGlobalSummary,
  buildAdminPodPayoutReadinessRow,
  computePodPayoutGlobalSummary,
} from "@/services/admin-pod-payout-transfer-list.service";
import type { AdminPodPayoutTransferRow } from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";
import type { PodPayoutTransferAdminSummary } from "@/services/pod-payout-transfer.service";

function transferRow(
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

function podSummary(partial: Partial<PodPayoutTransferAdminSummary>): PodPayoutTransferAdminSummary {
  return {
    pendingAllocationAmountCents: 0,
    pendingAllocationCount: 0,
    transferableAmountCents: 0,
    transferableCount: 0,
    blockedTransferAmountCents: 0,
    blockedTransferCount: 0,
    paidTransferAmountCents: 0,
    paidTransferCount: 0,
    minimumPayoutCents: 0,
    canRunPayoutBatch: false,
    nonTransferableAllocations: [],
    ...partial,
  };
}

describe("computePodPayoutGlobalSummary (transfer rows only)", () => {
  it("aggregates ready, blocked, and paid pod transfer totals", () => {
    const summary = computePodPayoutGlobalSummary([
      transferRow({ status: POD_PAYOUT_TRANSFER_STATUS.pending, amountCents: 1000 }),
      transferRow({ id: "ppt-2", status: POD_PAYOUT_TRANSFER_STATUS.failed, amountCents: 200 }),
      transferRow({ id: "ppt-3", status: POD_PAYOUT_TRANSFER_STATUS.paid, amountCents: 3000 }),
      transferRow({
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

describe("aggregatePodPayoutGlobalSummary", () => {
  it("aggregates allocation-level readiness across pods", () => {
    const summary = aggregatePodPayoutGlobalSummary([
      podSummary({
        pendingAllocationCount: 2,
        pendingAllocationAmountCents: 302,
        transferableCount: 1,
        transferableAmountCents: 302,
        canRunPayoutBatch: true,
        nonTransferableAllocations: [
          {
            allocationId: "ppa_2",
            orderId: "ord_2",
            amountCents: 38,
            reason: "waiting_on_vendor_transfer",
            reasonLabel: "Waiting on vendor transfer",
          },
        ],
        paidTransferCount: 1,
        paidTransferAmountCents: 500,
      }),
      podSummary({
        blockedTransferCount: 1,
        blockedTransferAmountCents: 100,
        nonTransferableAllocations: [
          {
            allocationId: "ppa_3",
            orderId: "ord_3",
            amountCents: 50,
            reason: "refund_review",
            reasonLabel: "Refund review required",
          },
        ],
      }),
    ]);

    expect(summary.pendingAllocationCount).toBe(2);
    expect(summary.pendingAllocationAmountCents).toBe(302);
    expect(summary.readyToBatchAmountCents).toBe(302);
    expect(summary.readyToBatchCount).toBe(1);
    expect(summary.readyToBatchPodCount).toBe(1);
    expect(summary.readyToTransferAmountCents).toBe(302);
    expect(summary.blockedCount).toBe(3);
    expect(summary.blockedAmountCents).toBe(188);
    expect(summary.paidCount).toBe(1);
    expect(summary.paidAmountCents).toBe(500);
  });
});

describe("buildAdminPodPayoutReadinessRow", () => {
  it("returns ready pod row when allocations are transferable without transfer rows", () => {
    const row = buildAdminPodPayoutReadinessRow(
      "pod_1",
      "Test Pod",
      podSummary({
        pendingAllocationCount: 1,
        pendingAllocationAmountCents: 302,
        transferableCount: 1,
        transferableAmountCents: 302,
        canRunPayoutBatch: true,
      })
    );

    expect(row).toMatchObject({
      podId: "pod_1",
      podName: "Test Pod",
      canRunPayoutBatch: true,
      readyToBatchAmountCents: 302,
    });
  });

  it("returns null when pod has no payout activity", () => {
    expect(buildAdminPodPayoutReadinessRow("pod_1", "Empty Pod", podSummary({}))).toBeNull();
  });
});
