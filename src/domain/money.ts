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

/** 3.5% service fee on subtotal (customer-facing). */
export function serviceFeeFromSubtotalCents(subtotalCents: number): number {
  return roundCents(subtotalCents * 0.035);
}

/** 2.75% platform commission on vendor subtotal. */
export function platformCommissionFromSubtotalCents(subtotalCents: number): number {
  return roundCents(subtotalCents * 0.0275);
}

/**
 * MVP: returns 0 — no automatic tax. Pickup-only; real product/jurisdiction tax belongs in a
 * dedicated tax engine later. Allocated `taxCents` on orders is still passed through to Deliverect
 * as restaurant-facing tax only (never mixed with the Mennyu platform fee).
 */
export function taxFromSubtotalCents(_subtotalCents: number, _location?: unknown): number {
  return 0;
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
