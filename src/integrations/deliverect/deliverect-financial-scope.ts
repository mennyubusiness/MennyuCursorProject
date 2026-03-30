/**
 * Financial scope for Deliverect vs Mennyu (Stripe) — read this before changing order payloads.
 *
 * **Mennyu / customer / Stripe (full order economics)**  
 * Parent `Order` and per-vendor `VendorOrder` rows store the complete checkout:
 * - `subtotalCents` — menu + modifiers (restaurant revenue base)
 * - `taxCents` — allocated tax (MVP may be 0; still “customer tax” in our model)
 * - `tipCents` — customer tip allocated to this vendor
 * - `serviceFeeCents` — **Mennyu 3.5% platform fee on subtotal share** (customer-facing; stays in Mennyu/Stripe accounting)
 * - `platformCommissionCents` — internal commission record; not sent to Deliverect
 * - `totalCents` — subtotal + tax + tip + service fee for this vendor slice (matches what we charge the customer on a pro-rata basis)
 *
 * **Deliverect / restaurant / POS (restaurant-facing only)**  
 * The kitchen and POS must not see the Mennyu platform fee as part of “what was paid for this order”
 * or as tax/serviceCharge/delivery — it is not restaurant revenue. Use:
 * - Line items: menu + modifier prices (already the case in `transform.ts`)
 * - `taxTotal` / `taxes[]`: `vendorOrder.taxCents` only (restaurant-relevant tax allocation)
 * - `payment.amount`: **subtotal + tax + tip** for this vendor order — **excluding** `serviceFeeCents`
 *
 * Stripe still captures the full customer charge including the platform fee; only the Deliverect payload is scoped down.
 *
 * @see {@link deliverectRestaurantFacingPaymentCents}
 */
import { addCents } from "@/domain/money";

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
