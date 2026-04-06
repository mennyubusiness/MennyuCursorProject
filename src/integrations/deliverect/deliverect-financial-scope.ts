/**
 * Financial scope for Deliverect vs Mennyu (Stripe) — read this before changing order payloads.
 *
 * **Mennyu / customer / Stripe (full order economics)**  
 * Parent `Order` and per-vendor `VendorOrder` rows store the complete checkout:
 * - `subtotalCents` — menu + modifiers (restaurant revenue base)
 * - `taxCents` — allocated tax (MVP may be 0; still “customer tax” in our model)
 * - `tipCents` — customer tip allocated to this vendor
 * - `serviceFeeCents` — **Mennyu customer service fee** on subtotal share (customer-facing; stays in Mennyu/Stripe accounting)
 * - `vendorProcessingFeeRecoveryCents` — pass-through processing recovery on vendor food subtotal (not assessed on tips); not sent to Deliverect
 * - `totalCents` — subtotal + tax + tip + service fee for this vendor slice (matches what we charge the customer on a pro-rata basis)
 *
 * **Deliverect / restaurant / POS (restaurant-facing only)**  
 * The kitchen and POS must not see the Mennyu platform fee as part of “what was paid for this order”
 * or as tax/serviceCharge/delivery — it is not restaurant revenue. Use:
 * - Line items: menu + modifier prices (already the case in `transform.ts`)
 * - `taxTotal` / `taxes[]`: `vendorOrder.taxCents` only (restaurant-relevant tax allocation from Mennyu’s
 *   pickup tax model — e.g. pod `pickupSalesTaxBps` on food subtotal — never the platform fee)
 * - `payment.amount`: **subtotal + tax + tip** for this vendor order — **excluding** `serviceFeeCents`
 *
 * Stripe still captures the full customer charge including the platform fee; only the Deliverect payload is scoped down.
 *
 * @see {@link deliverectRestaurantFacingPaymentCents}
 */
import { addCents } from "@/domain/money";

/**
 * Food + modifiers subtotal for one vendor slice, **excluding** tax, tip, and Mennyu’s platform
 * service fee. Canonical definition for Deliverect line-item totals and payment math:
 *
 * `totalCents - taxCents - serviceFeeCents - tipCents`
 *
 * This matches `VendorOrder.subtotalCents` for orders created by `computeOrderTotals` (since
 * `total = subtotal + fee + tax + tip`). Prefer this **derived** value when cross-checking payloads
 * so validation stays aligned with checkout totals even if `subtotalCents` is stale or inconsistent.
 */
export function vendorOrderItemSubtotalCents(vo: {
  totalCents: number;
  taxCents: number;
  serviceFeeCents: number;
  tipCents: number;
}): number {
  const total = Math.max(0, Math.round(vo.totalCents));
  const tax = Math.max(0, Math.round(vo.taxCents));
  const fee = Math.max(0, Math.round(vo.serviceFeeCents));
  const tip = Math.max(0, Math.round(vo.tipCents));
  return Math.max(0, total - tax - fee - tip);
}

/**
 * Total paid amount (minor units) that the restaurant/POS should reconcile against — pickup order,
 * one vendor slice. Excludes Mennyu’s platform service fee (`serviceFeeCents`).
 */
export function deliverectRestaurantFacingPaymentCents(vo: {
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
}): number {
  return addCents(vo.subtotalCents, vo.taxCents, vo.tipCents);
}
