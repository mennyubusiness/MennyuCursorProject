import { describe, expect, it } from "vitest";
import {
  deliverectRestaurantFacingPaymentCents,
  vendorOrderItemSubtotalCents,
} from "./deliverect-financial-scope";

describe("vendorOrderItemSubtotalCents", () => {
  it("derives food+modifiers subtotal from total minus tax, platform fee, and tip", () => {
    expect(
      vendorOrderItemSubtotalCents({
        totalCents: 1900,
        taxCents: 140,
        serviceFeeCents: 60,
        tipCents: 0,
      })
    ).toBe(1700);
  });
});

describe("deliverectRestaurantFacingPaymentCents", () => {
  it("sums subtotal, tax, and tip only", () => {
    expect(
      deliverectRestaurantFacingPaymentCents({
        subtotalCents: 1000,
        taxCents: 50,
        tipCents: 200,
      })
    ).toBe(1250);
  });
});
