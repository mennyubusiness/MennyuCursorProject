/**
 * Deterministic 4-digit pickup code for vendor-facing order display.
 * Derived from order id; no schema change. Human-readable, easy to say aloud.
 */

/**
 * Returns a stable 4-digit code (0000–9999) for the given order id.
 * Same order id always yields the same code. Not cryptographically secure.
 */
export function getPickupCode(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) {
    h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  }
  const n = h % 10000;
  return n.toString().padStart(4, "0");
}
