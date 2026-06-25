import { describe, expect, it } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  aggregatePodOwnerPayoutTotals,
  ownerTransferStatusLabel,
  pickLastSentTransfer,
} from "@/lib/pod-payout-owner-summary";

describe("aggregatePodOwnerPayoutTotals", () => {
  it("sums pending allocations", () => {
    const totals = aggregatePodOwnerPayoutTotals(
      [
        { status: POD_PAYOUT_ALLOCATION_STATUS.pending, podPayoutAmountCents: 500 },
        { status: POD_PAYOUT_ALLOCATION_STATUS.pending, podPayoutAmountCents: 250 },
      ],
      []
    );
    expect(totals.pendingAllocationAmountCents).toBe(750);
    expect(totals.pendingAllocationCount).toBe(2);
  });

  it("groups blocked and partial refund review as needs review", () => {
    const totals = aggregatePodOwnerPayoutTotals(
      [
        { status: POD_PAYOUT_ALLOCATION_STATUS.blocked, podPayoutAmountCents: 100 },
        {
          status: POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview,
          podPayoutAmountCents: 200,
        },
      ],
      []
    );
    expect(totals.blockedAmountCents).toBe(300);
    expect(totals.blockedCount).toBe(2);
    expect(totals.needsReviewCount).toBe(2);
  });

  it("groups cancelled allocations and transfers", () => {
    const totals = aggregatePodOwnerPayoutTotals(
      [{ status: POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund, podPayoutAmountCents: 400 }],
      [
        {
          id: "ppt_1",
          status: "cancelled_due_to_refund",
          amountCents: 100,
          createdAt: new Date("2026-01-01"),
        },
      ]
    );
    expect(totals.cancelledAmountCents).toBe(500);
    expect(totals.cancelledCount).toBe(2);
  });

  it("counts submitted and paid transfers as sent", () => {
    const totals = aggregatePodOwnerPayoutTotals(
      [],
      [
        {
          id: "ppt_1",
          status: "paid",
          amountCents: 500,
          stripeTransferId: "tr_1",
          createdAt: new Date("2026-01-01"),
          paidAt: new Date("2026-01-02"),
        },
        {
          id: "ppt_2",
          status: "submitted",
          amountCents: 300,
          createdAt: new Date("2026-01-03"),
        },
      ]
    );
    expect(totals.sentAmountCents).toBe(800);
    expect(totals.sentCount).toBe(2);
  });

  it("counts failed transfers as needs review", () => {
    const totals = aggregatePodOwnerPayoutTotals(
      [],
      [
        {
          id: "ppt_1",
          status: "failed",
          amountCents: 500,
          createdAt: new Date("2026-01-01"),
        },
      ]
    );
    expect(totals.needsReviewCount).toBe(1);
    expect(totals.blockedAmountCents).toBe(500);
  });
});

describe("ownerTransferStatusLabel", () => {
  it("uses plain owner-facing labels", () => {
    expect(ownerTransferStatusLabel("paid")).toBe("Transfer sent");
    expect(ownerTransferStatusLabel("pending")).toBe("Pending");
    expect(ownerTransferStatusLabel("blocked_partial_refund_review")).toBe("Needs review");
  });
});

describe("pickLastSentTransfer", () => {
  it("chooses the most recent paid transfer", () => {
    const last = pickLastSentTransfer([
      {
        id: "ppt_1",
        status: "paid",
        amountCents: 100,
        stripeTransferId: "tr_1",
        createdAt: new Date("2026-01-01"),
        paidAt: new Date("2026-01-01"),
      },
      {
        id: "ppt_2",
        status: "paid",
        amountCents: 200,
        stripeTransferId: "tr_2",
        createdAt: new Date("2026-01-02"),
        paidAt: new Date("2026-01-05"),
      },
    ]);
    expect(last?.amountCents).toBe(200);
  });
});
