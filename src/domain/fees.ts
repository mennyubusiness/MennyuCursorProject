/**
 * Checkout fee totals — thin re-export of {@link ./pricing-engine}.
 * Per-order amounts come from `computeOrderPricing` with rates loaded from `PricingConfig` at order time.
 */

export {
  computeOrderPricing,
  customerServiceFeeCentsFromSubtotal,
  DEFAULT_LEGACY_PRICING_RATES,
  vendorProcessingFeeRecoveryCentsFromVendorSubtotal,
  type OrderTotals,
  type OrderTotalsInput,
  type PricingRatesSnapshot,
  type VendorAllocation,
} from "./pricing-engine";

import {
  computeOrderPricing,
  DEFAULT_LEGACY_PRICING_RATES,
  type OrderTotals,
  type OrderTotalsInput,
  type PricingRatesSnapshot,
} from "./pricing-engine";

/**
 * @deprecated Use {@link computeOrderPricing} with rates from `getActivePricingRatesSnapshot` so checkout matches persisted orders.
 */
export function computeOrderTotals(
  input: OrderTotalsInput,
  rates: PricingRatesSnapshot = DEFAULT_LEGACY_PRICING_RATES
): OrderTotals {
  return computeOrderPricing(input, rates);
}

/** @deprecated Use {@link DEFAULT_LEGACY_PRICING_RATES}.customerServiceFeeBps / 10_000. */
export const SERVICE_FEE_RATE = DEFAULT_LEGACY_PRICING_RATES.customerServiceFeeBps / 10_000;

/** @deprecated Use {@link DEFAULT_LEGACY_PRICING_RATES}.vendorProcessingFeeBps / 10_000. */
export const VENDOR_PROCESSING_FEE_RATE = DEFAULT_LEGACY_PRICING_RATES.vendorProcessingFeeBps / 10_000;
