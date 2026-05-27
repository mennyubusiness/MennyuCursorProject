import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockOrderLineItemFindUnique = vi.fn();
const mockRefundLineItemFindMany = vi.fn();
const mockGetRemainingOrder = vi.fn();
const mockGetRemainingVendor = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: (...args: unknown[]) => mockOrderFindUnique(...args) },
    orderLineItem: { findUnique: (...args: unknown[]) => mockOrderLineItemFindUnique(...args) },
    refundLineItem: { findMany: (...args: unknown[]) => mockRefundLineItemFindMany(...args) },
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
  previewLineItemRefund,
  buildRefundExecutionPlan,
} from "./refund-calculation.service";

function lineItemRow(overrides?: Record<string, unknown>) {
  return {
    id: "li_1",
    name: "Burger",
    quantity: 2,
    priceCents: 500,
    vendorOrderId: "vo_1",
    vendorOrder: {
      id: "vo_1",
      orderId: "ord_1",
      subtotalCents: 1000,
      taxCents: 100,
      tipCents: 0,
      serviceFeeCents: 0,
    },
    ...overrides,
  };
}
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
    mockOrderLineItemFindUnique.mockResolvedValue(lineItemRow());
    mockRefundLineItemFindMany.mockResolvedValue([]);
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

  it("previewLineItemRefund full quantity", async () => {
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 2, {
      adminNote: "wrong item",
      reason: "missing",
    });
    expect(preview?.customerRefundAmountCents).toBe(1100);
    expect(preview?.requestedQuantity).toBe(2);
    expect(preview?.refundScope).toBe("line_item_refund");
  });

  it("previewLineItemRefund partial quantity", async () => {
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      adminNote: "one missing",
    });
    expect(preview?.subtotalRefundedCents).toBe(500);
    expect(preview?.taxRefundedCents).toBe(50);
    expect(preview?.customerRefundAmountCents).toBe(550);
  });

  it("blocks quantity over refundable", async () => {
    mockRefundLineItemFindMany.mockResolvedValue([{ quantityRefunded: 1 }]);
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 2, {
      adminNote: "note",
    });
    expect(preview?.blockingReasons.some((r) => r.includes("quantity_exceeds_refundable"))).toBe(
      true
    );
  });

  it("prior pending line-item refund reduces refundable quantity", async () => {
    mockRefundLineItemFindMany.mockResolvedValue([{ quantityRefunded: 1 }]);
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      adminNote: "note",
    });
    expect(preview?.alreadyRefundedQuantity).toBe(1);
    expect(preview?.refundableQuantity).toBe(1);
  });

  it("failed refunds do not reduce refundable quantity", async () => {
    mockRefundLineItemFindMany.mockResolvedValue([]);
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 2, {
      adminNote: "note",
    });
    expect(preview?.refundableQuantity).toBe(2);
  });

  it("includeTip adds proportional tip", async () => {
    mockOrderLineItemFindUnique.mockResolvedValue(
      lineItemRow({
        vendorOrder: {
          id: "vo_1",
          orderId: "ord_1",
          subtotalCents: 1000,
          taxCents: 0,
          tipCents: 100,
          serviceFeeCents: 0,
        },
      })
    );
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      includeTip: true,
      adminNote: "note",
    });
    expect(preview?.tipRefundedCents).toBe(50);
  });

  it("paid transfer blocks line item unless platformAbsorbsRefund", async () => {
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
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      adminNote: "note",
      platformAbsorbsRefund: false,
    });
    expect(preview?.blockingReasons.some((r) => r.includes("vendor_transfer_already_sent"))).toBe(
      true
    );
  });

  it("platformAbsorbsRefund requires admin note", async () => {
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
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      platformAbsorbsRefund: true,
    });
    expect(preview?.blockingReasons).toContain("admin_note_required_when_platform_absorbs");
  });

  it("waives admin note when linked issue has customer message", async () => {
    const preview = await previewLineItemRefund("ord_1", "vo_1", "li_1", 1, {
      linkedIssueHasCustomerMessage: true,
    });
    expect(preview?.blockingReasons).not.toContain("admin_note_required_for_line_item_refund");
  });
});
