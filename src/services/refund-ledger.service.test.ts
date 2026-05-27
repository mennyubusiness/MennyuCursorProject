import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockVendorOrderFindUnique = vi.fn();
const mockOrderRefundFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: (...args: unknown[]) => mockOrderFindUnique(...args) },
    vendorOrder: { findUnique: (...args: unknown[]) => mockVendorOrderFindUnique(...args) },
    orderRefund: {
      findUnique: (...args: unknown[]) => mockOrderRefundFindUnique(...args),
      create: vi.fn(),
      update: vi.fn(),
    },
    refundAttempt: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn() },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

import {
  getOrderRefundSummary,
  getRemainingOrderRefundableCents,
  getRemainingVendorOrderRefundableCents,
  recordPendingRefund,
} from "./refund-ledger.service";

describe("refund-ledger.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        order: { findUnique: mockOrderFindUnique, update: vi.fn() },
        vendorOrder: { findUnique: mockVendorOrderFindUnique, update: vi.fn() },
        orderRefund: { create: vi.fn().mockResolvedValue({ id: "or_new" }) },
      };
      return fn(tx);
    });
  });

  it("getRemainingOrderRefundableCents subtracts ledger + legacy", async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      totalCents: 2000,
      payments: [{ amountCents: 2000 }],
      orderRefunds: [{ amountCents: 500, status: "succeeded", refundAttemptId: "ra_1" }],
      refundAttempts: [
        { id: "ra_1", amountCents: 500, status: "succeeded" },
        { id: "ra_2", amountCents: 300, status: "succeeded" },
      ],
    });

    const remaining = await getRemainingOrderRefundableCents("ord_1");
    expect(remaining).toBe(1200);
  });

  it("getRemainingVendorOrderRefundableCents uses vendor slice totals", async () => {
    mockVendorOrderFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      totalCents: 800,
    });
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      totalCents: 2000,
      payments: [{ amountCents: 2000 }],
      orderRefunds: [
        {
          amountCents: 200,
          status: "succeeded",
          vendorOrderId: "vo_1",
          refundAttemptId: null,
        },
      ],
      refundAttempts: [],
    });

    const remaining = await getRemainingVendorOrderRefundableCents("vo_1");
    expect(remaining).toBe(600);
  });

  it("recordPendingRefund is idempotent by idempotencyKey", async () => {
    mockOrderRefundFindUnique.mockResolvedValue({ id: "or_existing" });
    const result = await recordPendingRefund({
      orderId: "ord_1",
      amountCents: 100,
      idempotencyKey: "key_1",
      reason: "customer_cancel",
      refundScope: "system_cancel",
      initiatedByRole: "customer",
      stripePaymentIntentId: "pi_1",
    });
    expect(result).toEqual({ id: "or_existing", created: false });
  });

  it("recordPendingRefund rejects over-refund", async () => {
    mockOrderRefundFindUnique.mockResolvedValue(null);
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      totalCents: 1000,
      payments: [{ amountCents: 1000 }],
      orderRefunds: [{ amountCents: 900, status: "succeeded", refundAttemptId: null }],
      refundAttempts: [],
    });

    await expect(
      recordPendingRefund({
        orderId: "ord_1",
        amountCents: 200,
        idempotencyKey: "key_2",
        reason: "customer_cancel",
        refundScope: "full_order",
        initiatedByRole: "customer",
        stripePaymentIntentId: "pi_1",
      })
    ).rejects.toThrow(/REFUND_EXCEEDS_ORDER_REMAINING/);
  });

  it("getOrderRefundSummary returns null for missing order", async () => {
    mockOrderFindUnique.mockResolvedValue(null);
    expect(await getOrderRefundSummary("missing")).toBeNull();
  });
});
