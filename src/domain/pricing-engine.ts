/**
 * Single source of truth for checkout economics: customer service fee (Mennyu revenue),
 * vendor processing fee recovery (pass-through on food subtotal only — tips excluded from the recovery base),
 * tax, and pro-rata splits. Amounts are cents; percents as basis points (350 = 3.50%).
 */

import {
  addCents,
  pickupSalesTaxFromSubtotalCents,
  roundCents,
  splitProRata,
  splitTipProRata,
} from "./money";

/** Immutable rates used for one pricing calculation (from DB `PricingConfig` at order time). */
export type PricingRatesSnapshot = {
  customerServiceFeeBps: number;
  customerServiceFeeFlatCents: number;
  vendorProcessingFeeBps: number;
  vendorProcessingFeeFlatCents: number;
};

/** Matches the previous hardcoded 3.5% / 2.75% behavior when DB seed is absent. */
export const DEFAULT_LEGACY_PRICING_RATES: PricingRatesSnapshot = {
  customerServiceFeeBps: 350,
  customerServiceFeeFlatCents: 0,
  vendorProcessingFeeBps: 275,
  vendorProcessingFeeFlatCents: 0,
};

export function customerServiceFeeCentsFromSubtotal(
  subtotalCents: number,
  rates: PricingRatesSnapshot
): number {
  const pct = roundCents((subtotalCents * rates.customerServiceFeeBps) / 10_000);
  return Math.max(0, pct + rates.customerServiceFeeFlatCents);
}

/**
 * Recovery on vendor **food subtotal only** (same as legacy `platformCommission` behavior).
 * Tips are not included in `vendorSubtotalCents` — recovery never reduces tip allocations.
 */
export function vendorProcessingFeeRecoveryCentsFromVendorSubtotal(
  vendorSubtotalCents: number,
  rates: PricingRatesSnapshot
): number {
  const pct = roundCents((vendorSubtotalCents * rates.vendorProcessingFeeBps) / 10_000);
  return Math.max(0, pct + rates.vendorProcessingFeeFlatCents);
}

export interface VendorAllocationInput {
  vendorSubtotalCents: number;
}

export interface VendorAllocation {
  subtotalCents: number;
  tipCents: number;
  taxCents: number;
  serviceFeeCents: number;
  totalCents: number;
  /** Pass-through processing recovery on food subtotal (not from tips). */
  vendorProcessingFeeRecoveryCents: number;
  /** subtotal + tax + tip — restaurant-facing gross before Mennyu processing recovery. */
  vendorGrossPayableCents: number;
  /** Gross payable minus processing recovery (actual Stripe card fee applied later at payment). */
  vendorNetPayoutCents: number;
}

export interface OrderTotalsInput {
  vendorSubtotalsCents: number[];
  tipCents: number;
  /** Pod `pickupSalesTaxBps` — Mennyu-computed pickup tax on food subtotal; null = none. */
  pickupSalesTaxBps?: number | null;
}

export interface OrderTotals {
  subtotalCents: number;
  serviceFeeCents: number;
  tipCents: number;
  taxCents: number;
  totalCents: number;
  vendorAllocations: VendorAllocation[];
}

/**
 * Compute order-level totals and per-vendor allocations from a pricing snapshot.
 */
export function computeOrderPricing(input: OrderTotalsInput, rates: PricingRatesSnapshot): OrderTotals {
  const subtotalCents = input.vendorSubtotalsCents.reduce((a, b) => a + b, 0);
  const serviceFeeCents = customerServiceFeeCentsFromSubtotal(subtotalCents, rates);
  const taxCents = pickupSalesTaxFromSubtotalCents(subtotalCents, input.pickupSalesTaxBps);
  const tipCents = input.tipCents;
  const totalCents = addCents(subtotalCents, serviceFeeCents, taxCents, tipCents);

  const tipAllocations = splitTipProRata(tipCents, input.vendorSubtotalsCents);
  const serviceFeeAllocations = splitProRata(serviceFeeCents, input.vendorSubtotalsCents);
  const taxAllocations = splitProRata(taxCents, input.vendorSubtotalsCents);

  const vendorAllocations: VendorAllocation[] = input.vendorSubtotalsCents.map((sub, i) => {
    const fee = serviceFeeAllocations[i] ?? 0;
    const tax = taxAllocations[i] ?? 0;
    const tip = tipAllocations[i] ?? 0;
    const total = addCents(sub, fee, tax, tip);
    const vendorProcessingFeeRecoveryCents = vendorProcessingFeeRecoveryCentsFromVendorSubtotal(sub, rates);
    const vendorGrossPayableCents = addCents(sub, tax, tip);
    const vendorNetPayoutCents = Math.max(0, vendorGrossPayableCents - vendorProcessingFeeRecoveryCents);
    return {
      subtotalCents: sub,
      tipCents: tip,
      taxCents: tax,
      serviceFeeCents: fee,
      totalCents: total,
      vendorProcessingFeeRecoveryCents,
      vendorGrossPayableCents,
      vendorNetPayoutCents,
    };
  });

  return {
    subtotalCents,
    serviceFeeCents,
    tipCents,
    taxCents,
    totalCents,
    vendorAllocations,
  };
}
