/**
 * Pure cart row selection for a session that may have one cart per pod.
 * Single place for “which cart do we show?” logic — keep /cart and tests aligned.
 */

export type CartRowWithPod = { podId: string };

/**
 * Prefer the cart for `preferredPodId` when the session has multiple carts; otherwise the first row
 * (callers should pass `carts` already ordered, e.g. `updatedAt desc`).
 */
export function selectCartForSessionAndPod<T extends CartRowWithPod>(
  carts: T[],
  preferredPodId: string | null
): T | undefined {
  if (carts.length === 0) return undefined;
  if (preferredPodId) {
    const match = carts.find((c) => c.podId === preferredPodId);
    if (match) return match;
  }
  return carts[0];
}
