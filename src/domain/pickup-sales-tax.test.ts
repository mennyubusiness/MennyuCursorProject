import { describe, expect, it } from "vitest";
import { pickupSalesTaxFromSubtotalCents } from "./money";
import { computeOrderTotals } from "./fees";

describe("pickupSalesTaxFromSubtotalCents", () => {
  it("returns 0 when bps missing or non-positive", () => {
    expect(pickupSalesTaxFromSubtotalCents(1000, null)).toBe(0);
    expect(pickupSalesTaxFromSubtotalCents(1000, undefined)).toBe(0);
    expect(pickupSalesTaxFromSubtotalCents(1000, 0)).toBe(0);
  });

  it("computes 8.25% on $100", () => {
    expect(pickupSalesTaxFromSubtotalCents(10_000, 825)).toBe(825);
  });
});

describe("computeOrderTotals with pickupSalesTaxBps", () => {
  it("allocates tax pro-rata like other fees", () => {
    const t = computeOrderTotals({
      vendorSubtotalsCents: [6000, 4000],
      tipCents: 0,
      pickupSalesTaxBps: 1000,
    });
    expect(t.taxCents).toBe(1000);
    expect(t.vendorAllocations[0]!.taxCents + t.vendorAllocations[1]!.taxCents).toBe(1000);
  });
});
