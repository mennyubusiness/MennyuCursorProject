import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVptFindUnique = vi.fn();
const mockOrderRefundFindMany = vi.fn();
const mockRefundAttemptFindMany = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockReversalCreate = vi.fn();
const mockReversalFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockVptFindUnique(...args),
    },
    orderRefund: {
      findMany: (...args: unknown[]) => mockOrderRefundFindMany(...args),
    },
    refundAttempt: {
      findMany: (...args: unknown[]) => mockRefundAttemptFindMany(...args),
    },
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
    vendorPayoutTransferReversal: {
      create: (...args: unknown[]) => mockReversalCreate(...args),
      findUnique: (...args: unknown[]) => mockReversalFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { transfers: { createReversal: vi.fn() } },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

import {
  prepareMissingTransferReversalForRefund,
  VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS,
} from "./vendor-payout-transfer-reversal.service";

function paidTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "vpt_1",
    vendorId: "vendor_1",
    vendorOrderId: "vo_1",
    amountCents: 2240,
    currency: "usd",
    status: "paid",
    stripeTransferId: "tr_123",
    reversals: [],
    vendorOrder: {
      id: "vo_1",
      orderId: "order_1",
      totalCents: 2408,
      order: { id: "order_1", totalCents: 2408, totalRefundedCents: 2408 },
    },
    ...overrides,
  };
}

describe("prepareMissingTransferReversalForRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVptFindUnique.mockResolvedValue(paidTransfer());
    mockOrderRefundFindMany.mockResolvedValue([
      {
        id: "or_1",
        vendorOrderId: null,
        amountCents: 2408,
        refundScope: "full_order",
        status: "succeeded",
        refundAttemptId: "ra_1",
        refundAttempt: { id: "ra_1", status: "succeeded" },
      },
    ]);
    mockRefundAttemptFindMany.mockResolvedValue([]);
    mockOrderFindUnique.mockResolvedValue({ totalRefundedCents: 2408 });
    mockReversalCreate.mockResolvedValue({ id: "rev_1" });
    mockReversalFindUnique.mockResolvedValue(null);
  });

  it("creates a pending VendorPayoutTransferReversal for full-order refund + paid transfer", async () => {
    const result = await prepareMissingTransferReversalForRefund({
      orderId: "order_1",
      vendorPayoutTransferId: "vpt_1",
    });

    expect(result.ok).toBe(true);
    expect(mockReversalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorPayoutTransferId: "vpt_1",
          vendorOrderId: "vo_1",
          orderId: "order_1",
          refundAttemptId: "ra_1",
          amountCents: 2240,
          status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.pending,
        }),
      })
    );
  });

  it("refuses partial/custom refunds by requiring safe full-scope refund rows", async () => {
    mockOrderRefundFindMany.mockResolvedValue([]);
    mockOrderFindUnique.mockResolvedValue({ totalRefundedCents: 0 });
    const result = await prepareMissingTransferReversalForRefund({
      orderId: "order_1",
      vendorPayoutTransferId: "vpt_1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_succeeded_order_refund");
    }
    expect(mockReversalCreate).not.toHaveBeenCalled();
  });

  it("refuses unpaid transfers", async () => {
    mockVptFindUnique.mockResolvedValue(
      paidTransfer({ status: "pending", stripeTransferId: null })
    );
    const result = await prepareMissingTransferReversalForRefund({
      orderId: "order_1",
      vendorPayoutTransferId: "vpt_1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("transfer_not_paid_via_connect");
    }
    expect(mockOrderRefundFindMany).not.toHaveBeenCalled();
    expect(mockReversalCreate).not.toHaveBeenCalled();
  });

  it("does not create duplicate reversal rows", async () => {
    mockVptFindUnique.mockResolvedValue(
      paidTransfer({
        reversals: [
          {
            id: "rev_existing",
            status: "pending",
            refundAttemptId: "ra_1",
            amountCents: 2240,
          },
        ],
      })
    );
    const result = await prepareMissingTransferReversalForRefund({
      orderId: "order_1",
      vendorPayoutTransferId: "vpt_1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("idempotent_noop");
      expect(result.reversalId).toBe("rev_existing");
    }
    expect(mockReversalCreate).not.toHaveBeenCalled();
  });
});
