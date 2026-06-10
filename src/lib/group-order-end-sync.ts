import type { Cart } from "@/domain/types";
import { dispatchCartUpdated } from "@/lib/cart-client-sync";

const GROUP_END_SYNC_STORAGE_PREFIX = "oo:group-end-sync:";

function wasGroupOrderEndAlreadySynced(endedSessionId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(`${GROUP_END_SYNC_STORAGE_PREFIX}${endedSessionId}`) === "1";
}

function markGroupOrderEndSynced(endedSessionId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${GROUP_END_SYNC_STORAGE_PREFIX}${endedSessionId}`, "1");
}

/** Strip active group-order UI from a post-end cart snapshot (items already cleared server-side). */
export function buildPostEndCartClientSnapshot(cart: Cart | null): Cart | null {
  if (!cart) return null;
  return {
    ...cart,
    items: [],
    groups: [],
    subtotalCents: 0,
    groupOrder: undefined,
    cartScope: undefined,
  };
}

/** Push authoritative post-end cart state to Quick Cart, vendor menu, and cart page listeners. */
export function dispatchGroupOrderEndCartSnapshot(
  cart: Cart | null,
  opts?: { endedSessionId?: string }
): void {
  const dedupeKey =
    opts?.endedSessionId?.trim() || (cart?.id ? `cart:${cart.id}` : null);
  if (dedupeKey && wasGroupOrderEndAlreadySynced(dedupeKey)) {
    return;
  }
  if (dedupeKey) {
    markGroupOrderEndSynced(dedupeKey);
  }
  dispatchCartUpdated({ cart: buildPostEndCartClientSnapshot(cart), source: "group-order-ended" });
}
