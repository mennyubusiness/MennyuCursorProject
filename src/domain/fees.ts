/**
 * Fee and allocation logic: service fee 3.5%, commission 2.75%, tip pro-rata.
 * All amounts in cents.
 *
 * The 3.5% service fee is stored on `VendorOrder.serviceFeeCents` and in parent totals for Stripe.
 * It is **not** sent to Deliverect — see `integrations/deliverect/deliverect-financial-scope.ts`.
 */

import {
  serviceFeeFromSubtotalCents,
  platformCommissionFromSubtotalCents,
  taxFromSubtotalCents,
  splitTipProRata,
  splitProRata,
  addCents,
} from "./money";

export const SERVICE_FEE_RATE = 0.035;
export const VENDOR_COMMISSION_RATE = 0.0275;

export interface VendorAllocationInput {
  vendorSubtotalCents: number;
}

export interface VendorAllocation {
  subtotalCents: number;
  tipCents: number;
  taxCents: number;
  serviceFeeCents: number;
  totalCents: number;
  platformCommissionCents: number;
}

export interface OrderTotalsInput {
  vendorSubtotalsCents: number[];
  tipCents: number;
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
 * Compute order-level totals and per-vendor allocations.
 * Service fee = 3.5% of subtotal. Tip split pro-rata. Tax MVP = 0.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalCents = input.vendorSubtotalsCents.reduce((a, b) => a + b, 0);
  const serviceFeeCents = serviceFeeFromSubtotalCents(subtotalCents);
  const taxCents = taxFromSubtotalCents(subtotalCents);
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
    const platformCommissionCents = platformCommissionFromSubtotalCents(sub);
    return {
      subtotalCents: sub,
      tipCents: tip,
      taxCents: tax,
      serviceFeeCents: fee,
      totalCents: total,
      platformCommissionCents,
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
