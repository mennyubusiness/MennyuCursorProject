import { describe, expect, it } from "vitest";
import { deliverectRestaurantFacingPaymentCents } from "./deliverect-financial-scope";

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
