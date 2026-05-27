import { describe, expect, it } from "vitest";
import {
  buildAdminRefundIdempotencyKey,
  buildAdminStripeRefundIdempotencyKey,
} from "./admin-refund-idempotency";

describe("admin-refund idempotency keys", () => {
  it("stable admin refund key", () => {
    expect(
      buildAdminRefundIdempotencyKey({
        scope: "full_vendor_order",
        orderId: "ord_1",
        vendorOrderId: "vo_1",
        amountCents: 500,
      })
    ).toBe("admin:full_vendor_order:ord_1:vo_1:500");
  });

  it("line item key includes line item id and quantity", () => {
    expect(
      buildAdminRefundIdempotencyKey({
        scope: "line_item_refund",
        orderId: "ord_1",
        vendorOrderId: "vo_1",
        orderLineItemId: "li_1",
        quantity: 2,
        amountCents: 1100,
      })
    ).toBe("admin:line_item_refund:ord_1:vo_1:li_1:2:1100");
  });

  it("stripe key prefixes admin key", () => {
    const db = buildAdminRefundIdempotencyKey({
      scope: "full_order",
      orderId: "ord_1",
      amountCents: 1000,
    });
    expect(buildAdminStripeRefundIdempotencyKey(db)).toBe(`stripe_${db}`);
  });
});
