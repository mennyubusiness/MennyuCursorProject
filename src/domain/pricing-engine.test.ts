import { describe, expect, it } from "vitest";
import {
  computeOrderPricing,
  customerServiceFeeCentsFromSubtotal,
  DEFAULT_LEGACY_PRICING_RATES,
  vendorProcessingFeeRecoveryCentsFromVendorSubtotal,
} from "./pricing-engine";

describe("customerServiceFeeCentsFromSubtotal", () => {
  it("uses bps and flat cents", () => {
    expect(
      customerServiceFeeCentsFromSubtotal(10_000, {
        ...DEFAULT_LEGACY_PRICING_RATES,
        customerServiceFeeBps: 500,
        customerServiceFeeFlatCents: 25,
      })
    ).toBe(525);
  });
});

describe("vendorProcessingFeeRecoveryCentsFromVendorSubtotal", () => {
  it("does not use tip — only vendor food subtotal", () => {
    const rates = { ...DEFAULT_LEGACY_PRICING_RATES, vendorProcessingFeeBps: 275, vendorProcessingFeeFlatCents: 0 };
    expect(vendorProcessingFeeRecoveryCentsFromVendorSubtotal(10_000, rates)).toBe(275);
    expect(vendorProcessingFeeRecoveryCentsFromVendorSubtotal(0, rates)).toBe(0);
  });
});

describe("computeOrderPricing", () => {
  it("keeps full tip in gross and reduces net only by subtotal-based recovery", () => {
    const rates = {
      customerServiceFeeBps: 350,
      customerServiceFeeFlatCents: 0,
      vendorProcessingFeeBps: 275,
      vendorProcessingFeeFlatCents: 0,
    };
    const t = computeOrderPricing(
      {
        vendorSubtotalsCents: [10_000],
        tipCents: 5_000,
        pickupSalesTaxBps: null,
      },
      rates
    );
    const a = t.vendorAllocations[0]!;
    expect(a.tipCents).toBe(5_000);
    expect(a.vendorGrossPayableCents).toBe(15_000);
    expect(a.vendorProcessingFeeRecoveryCents).toBe(275);
    expect(a.vendorNetPayoutCents).toBe(15_000 - 275);
  });

  it("matches legacy default rates on a simple single-vendor order", () => {
    const t = computeOrderPricing(
      {
        vendorSubtotalsCents: [10_000],
        tipCents: 0,
        pickupSalesTaxBps: null,
      },
      DEFAULT_LEGACY_PRICING_RATES
    );
    expect(t.serviceFeeCents).toBe(350);
    expect(t.vendorAllocations[0]!.vendorProcessingFeeRecoveryCents).toBe(275);
  });
});
