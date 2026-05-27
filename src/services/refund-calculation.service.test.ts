import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockGetRemainingOrder = vi.fn();
const mockGetRemainingVendor = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: (...args: unknown[]) => mockOrderFindUnique(...args) },
  },
}));

vi.mock("@/services/refund-ledger.service", () => ({
  getRemainingOrderRefundableCents: (...args: unknown[]) => mockGetRemainingOrder(...args),
  getRemainingVendorOrderRefundableCents: (...args: unknown[]) =>
    mockGetRemainingVendor(...args),
}));

import {
  previewCustomVendorOrderRefund,
  previewFullOrderRefund,
  previewFullVendorOrderRefund,
  buildRefundExecutionPlan,
} from "./refund-calculation.service";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "./vendor-payout-transfer.service";

function baseOrder(overrides?: Record<string, unknown>) {
  return {
    id: "ord_1",
    totalCents: 2000,
    stripePaymentIntentId: "pi_1",
    vendorOrders: [{ id: "vo_1", totalCents: 1200 }],
    payments: [
      {
        id: "pay_1",
        stripePaymentIntentId: "pi_1",
        stripeChargeId: "ch_1",
        allocations: [
          {
            id: "alloc_1",
            paymentId: "pay_1",
            vendorOrderId: "vo_1",
            grossVendorPayableCents: 1100,
            allocatedProcessingFeeCents: 50,
            netVendorTransferCents: 1050,
            payoutTransfer: {
              id: "vpt_1",
              vendorOrderId: "vo_1",
              amountCents: 1050,
              status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
              stripeTransferId: null,
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("refund-calculation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRemainingOrder.mockResolvedValue(2000);
    mockGetRemainingVendor.mockResolvedValue(1200);
    mockOrderFindUnique.mockResolvedValue(baseOrder());
  });

  it("previewFullOrderRefund uses remaining order refundable", async () => {
    mockGetRemainingOrder.mockResolvedValue(1500);
    const preview = await previewFullOrderRefund("ord_1");
    expect(preview?.customerRefundAmountCents).toBe(1500);
    expect(preview?.refundScope).toBe("full_order");
    expect(preview?.paymentAllocations[0]?.netVendorTransferCents).toBe(1050);
  });

  it("previewFullVendorOrderRefund uses remaining vendor refundable", async () => {
    mockGetRemainingVendor.mockResolvedValue(800);
    const preview = await previewFullVendorOrderRefund("ord_1", "vo_1");
    expect(preview?.customerRefundAmountCents).toBe(800);
    expect(preview?.vendorOrderId).toBe("vo_1");
  });

  it("blocks custom partial over vendor remaining", async () => {
    mockGetRemainingVendor.mockResolvedValue(500);
    const preview = await previewCustomVendorOrderRefund("ord_1", "vo_1", 600, {
      adminNote: "partial adjustment",
    });
    expect(preview?.blockingReasons.some((r) => r.includes("vendor_order_remaining"))).toBe(
      true
    );
  });

  it("blocks zero amount", async () => {
    const preview = await previewCustomVendorOrderRefund("ord_1", "vo_1", 0, {
      adminNote: "note",
    });
    expect(preview?.blockingReasons).toContain("amount_must_be_positive");
  });

  it("custom partial requires admin note", async () => {
    const preview = await previewCustomVendorOrderRefund("ord_1", "vo_1", 100);
    expect(preview?.blockingReasons).toContain("admin_note_required_for_custom_partial");
  });

  it("paid transfer blocks custom partial without platformAbsorbsRefund", async () => {
    mockOrderFindUnique.mockResolvedValue(
      baseOrder({
        payments: [
          {
            id: "pay_1",
            stripePaymentIntentId: "pi_1",
            stripeChargeId: "ch_1",
            allocations: [
              {
                id: "alloc_1",
                paymentId: "pay_1",
                vendorOrderId: "vo_1",
                grossVendorPayableCents: 1100,
                allocatedProcessingFeeCents: 50,
                netVendorTransferCents: 1050,
                payoutTransfer: {
                  id: "vpt_1",
                  vendorOrderId: "vo_1",
                  amountCents: 1050,
                  status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
                  stripeTransferId: "tr_1",
                },
              },
            ],
          },
        ],
      })
    );
    mockGetRemainingVendor.mockResolvedValue(500);
    const preview = await previewCustomVendorOrderRefund("ord_1", "vo_1", 200, {
      adminNote: "note",
      platformAbsorbsRefund: false,
    });
    expect(preview?.blockingReasons.some((r) => r.includes("vendor_transfer_already_sent"))).toBe(
      true
    );
  });

  it("pending transfer does not require Stripe reversal", async () => {
    const preview = await previewFullVendorOrderRefund("ord_1", "vo_1");
    expect(preview?.transferReversalRequired).toBe(false);
    expect(preview?.warnings.some((w) => w.includes("pending"))).toBe(true);
  });

  it("paid transfer flags reversal required on full vendor refund", async () => {
    mockOrderFindUnique.mockResolvedValue(
      baseOrder({
        vendorOrders: [{ id: "vo_1", totalCents: 1200 }],
        payments: [
          {
            id: "pay_1",
            stripePaymentIntentId: "pi_1",
            stripeChargeId: "ch_1",
            allocations: [
              {
                id: "alloc_1",
                paymentId: "pay_1",
                vendorOrderId: "vo_1",
                grossVendorPayableCents: 1100,
                allocatedProcessingFeeCents: 50,
                netVendorTransferCents: 1050,
                payoutTransfer: {
                  id: "vpt_1",
                  vendorOrderId: "vo_1",
                  amountCents: 1050,
                  status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
                  stripeTransferId: "tr_1",
                },
              },
            ],
          },
        ],
      })
    );
    mockGetRemainingVendor.mockResolvedValue(1200);
    const preview = await previewFullVendorOrderRefund("ord_1", "vo_1");
    expect(preview?.transferReversalRequired).toBe(true);
    expect(preview?.transferReversalPossible).toBe(true);
    expect(preview?.estimatedTransferReversalAmountCents).toBe(1050);
  });

  it("buildRefundExecutionPlan includes idempotency key", async () => {
    const plan = await buildRefundExecutionPlan({
      scope: "full_order",
      orderId: "ord_1",
      reason: "admin resolution",
    });
    expect(plan?.idempotencyKey).toBe("admin:full_order:ord_1:_:2000");
  });
});
