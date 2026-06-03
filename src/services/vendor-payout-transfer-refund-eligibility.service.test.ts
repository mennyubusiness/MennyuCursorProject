import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockVendorOrderFindMany = vi.fn();
const mockVendorOrderFindUnique = vi.fn();
const mockGetRemainingVendorOrderRefundableCents = vi.fn();
const mockGetOrderRefundSummary = vi.fn();
const mockCreateOrderIssue = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    vendorOrder: {
      findMany: (...args: unknown[]) => mockVendorOrderFindMany(...args),
      findUnique: (...args: unknown[]) => mockVendorOrderFindUnique(...args),
    },
  },
}));

vi.mock("@/services/refund-ledger.service", () => ({
  getRemainingVendorOrderRefundableCents: (...args: unknown[]) =>
    mockGetRemainingVendorOrderRefundableCents(...args),
  getOrderRefundSummary: (...args: unknown[]) => mockGetOrderRefundSummary(...args),
}));

vi.mock("@/services/issues.service", () => ({
  createOrderIssue: (...args: unknown[]) => mockCreateOrderIssue(...args),
}));

import {
  CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
  CANCELLED_DUE_TO_REFUND_STATUS,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import { syncVendorTransferEligibilityAfterRefundSuccess } from "./vendor-payout-transfer-refund-eligibility.service";

describe("syncVendorTransferEligibilityAfterRefundSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCreateOrderIssue.mockResolvedValue(undefined);
  });

  it("cancels all unsent transfers when full vendor-order refund extinguishes obligation", async () => {
    mockVendorOrderFindMany.mockResolvedValue([{ id: "vo_a" }, { id: "vo_b" }]);
    mockGetOrderRefundSummary.mockResolvedValue({
      orderId: "ord_1",
      totalRefundedCents: 2000,
      remainingRefundableCents: 0,
    });
    mockVendorOrderFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      totalCents: 1000,
    }));
    mockGetRemainingVendorOrderRefundableCents.mockResolvedValue(0);
    mockFindMany.mockImplementation(async ({ where }: { where: { vendorOrderId: { in: string[] } } }) => {
      const id = where.vendorOrderId.in[0];
      return [
        {
          id: `vpt_${id}`,
          vendorOrderId: id,
          status: "pending",
          blockedReason: null,
          stripeTransferId: null,
          amountCents: 800,
        },
      ];
    });

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.cancelledDueToRefund).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CANCELLED_DUE_TO_REFUND_STATUS,
          blockedReason: CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
        }),
      })
    );
  });

  it("cancels only the refunded vendor order on scoped vendor-order refund", async () => {
    mockVendorOrderFindUnique.mockResolvedValue({ id: "vo_a", totalCents: 1000 });
    mockGetRemainingVendorOrderRefundableCents.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_a",
        vendorOrderId: "vo_a",
        status: "failed",
        blockedReason: null,
        stripeTransferId: null,
        amountCents: 500,
      },
    ]);

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: "ord_1",
      vendorOrderId: "vo_a",
    });

    expect(result.cancelledDueToRefund).toBe(1);
    expect(mockVendorOrderFindMany).not.toHaveBeenCalled();
  });

  it("does not cancel paid transfers with stripeTransferId", async () => {
    mockVendorOrderFindUnique.mockResolvedValue({ id: "vo_a", totalCents: 1000 });
    mockGetRemainingVendorOrderRefundableCents.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_paid",
        vendorOrderId: "vo_a",
        status: "paid",
        blockedReason: null,
        stripeTransferId: "tr_123",
        amountCents: 500,
      },
    ]);

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: "ord_1",
      vendorOrderId: "vo_a",
    });

    expect(result.skippedPaid).toBe(1);
    expect(result.cancelledDueToRefund).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocks partial refund transfers for manual review instead of cancelling", async () => {
    mockVendorOrderFindUnique.mockResolvedValue({ id: "vo_a", totalCents: 1000 });
    mockGetRemainingVendorOrderRefundableCents.mockResolvedValue(400);
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_a",
        vendorOrderId: "vo_a",
        status: "pending",
        blockedReason: null,
        stripeTransferId: null,
        amountCents: 600,
      },
    ]);

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: "ord_1",
      vendorOrderId: "vo_a",
    });

    expect(result.blockedPartialRefundReview).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PARTIAL_REFUND_MANUAL_REVIEW_STATUS }),
      })
    );
  });

  it("does nothing when vendor order has no refund", async () => {
    mockVendorOrderFindUnique.mockResolvedValue({ id: "vo_a", totalCents: 1000 });
    mockGetRemainingVendorOrderRefundableCents.mockResolvedValue(1000);

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: "ord_1",
      vendorOrderId: "vo_a",
    });

    expect(result.examined).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocks order-level partial refunds for manual review on all vendor transfers", async () => {
    mockVendorOrderFindMany.mockResolvedValue([{ id: "vo_a" }]);
    mockGetOrderRefundSummary.mockResolvedValue({
      orderId: "ord_1",
      totalRefundedCents: 500,
      remainingRefundableCents: 1500,
    });
    mockVendorOrderFindUnique.mockResolvedValue({ id: "vo_a", totalCents: 2000 });
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_a",
        vendorOrderId: "vo_a",
        status: "pending",
        blockedReason: null,
        stripeTransferId: null,
        amountCents: 1800,
      },
    ]);

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.blockedPartialRefundReview).toBe(1);
    expect(mockGetRemainingVendorOrderRefundableCents).not.toHaveBeenCalled();
  });

  it("surfaces admin issue when sync throws", async () => {
    mockVendorOrderFindUnique.mockRejectedValue(new Error("db_down"));

    const result = await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: "ord_1",
      vendorOrderId: "vo_a",
    });

    expect(result.errors.length).toBe(1);
    expect(mockCreateOrderIssue).toHaveBeenCalledWith(
      "ord_1",
      "manual_refund",
      "HIGH",
      expect.objectContaining({ createdBy: "system" })
    );
  });
});
