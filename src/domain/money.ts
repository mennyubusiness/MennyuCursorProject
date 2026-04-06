/**
 * Money arithmetic in cents. Avoid floating point for currency.
 */

/**
 * Effective unit price for a configured cart/order line.
 * Rule: unit price = base menu item price + sum(selected modifier price × quantity).
 * Used when persisting cart items and when validating/displaying.
 */
export function computeEffectiveUnitPriceCents(
  basePriceCents: number,
  selections: Array<{ priceCents: number; quantity: number }>
): number {
  const modifierCents = selections.reduce(
    (sum, s) => sum + s.priceCents * s.quantity,
    0
  );
  return basePriceCents + modifierCents;
}

export function addCents(...amounts: number[]): number {
  return amounts.reduce((a, b) => a + b, 0);
}

export function roundCents(value: number): number {
  return Math.round(value);
}

/**
 * Pickup sales tax computed by Mennyu from the pod’s configured rate — not vendor-entered per order.
 * @param taxRateBps — basis points (825 = 8.25%). Null, undefined, or ≤0 → no tax.
 * For Stripe/Deliverect, allocated `taxCents` remains restaurant-facing only (never the Mennyu platform fee).
 */
export function pickupSalesTaxFromSubtotalCents(
  subtotalCents: number,
  taxRateBps: number | null | undefined
): number {
  if (taxRateBps == null || taxRateBps <= 0) return 0;
  return roundCents((subtotalCents * taxRateBps) / 10_000);
}

/**
 * Split tip pro-rata by vendor subtotal share.
 * Returns array of tip amounts in cents (one per vendor), sum <= tipCents.
 */
export function splitTipProRata(
  tipCents: number,
  vendorSubtotalsCents: number[]
): number[] {
  const total = vendorSubtotalsCents.reduce((a, b) => a + b, 0);
  if (total === 0) return vendorSubtotalsCents.map(() => 0);
  const shares = vendorSubtotalsCents.map((s) => s / total);
  const allocated = shares.map((share) => roundCents(tipCents * share));
  const diff = tipCents - allocated.reduce((a, b) => a + b, 0);
  if (diff !== 0 && allocated.length > 0) {
    allocated[0] += diff;
  }
  return allocated;
}

/**
 * Split a total amount pro-rata by weights (e.g. service fee by subtotal).
 */
export function splitProRata(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return weights.map(() => 0);
  const shares = weights.map((w) => w / totalWeight);
  const allocated = shares.map((s) => roundCents(totalCents * s));
  const diff = totalCents - allocated.reduce((a, b) => a + b, 0);
  if (diff !== 0 && allocated.length > 0) allocated[0] += diff;
  return allocated;
}
