import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRefundLineItemFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    refundLineItem: {
      findMany: (...args: unknown[]) => mockRefundLineItemFindMany(...args),
    },
  },
}));

import {
  computeLineItemRefundComponents,
  getCommittedRefundedQuantityForLineItem,
} from "./refund-line-item.service";

describe("refund-line-item.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefundLineItemFindMany.mockResolvedValue([]);
  });

  it("sums committed refunded quantity", async () => {
    mockRefundLineItemFindMany.mockResolvedValue([
      { quantityRefunded: 1 },
      { quantityRefunded: 2 },
    ]);
    const qty = await getCommittedRefundedQuantityForLineItem("li_1");
    expect(qty).toBe(3);
    expect(mockRefundLineItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderLineItemId: "li_1",
          orderRefund: { status: { in: ["succeeded", "pending", "requires_action"] } },
        }),
      })
    );
  });

  it("computes proportional tax and subtotal", () => {
    const c = computeLineItemRefundComponents({
      priceCents: 500,
      purchasedQuantity: 2,
      refundQuantity: 1,
      vendorSubtotalCents: 1000,
      vendorTaxCents: 100,
      vendorTipCents: 50,
      vendorServiceFeeCents: 20,
      includeTax: true,
      includeTip: false,
      includeServiceFee: false,
    });
    expect(c.subtotalRefundedCents).toBe(500);
    expect(c.taxRefundedCents).toBe(50);
    expect(c.tipRefundedCents).toBe(0);
    expect(c.serviceFeeRefundedCents).toBe(0);
    expect(c.amountCents).toBe(550);
  });
});
