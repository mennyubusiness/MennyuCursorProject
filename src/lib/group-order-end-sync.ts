import type { Cart } from "@/domain/types";
import { dispatchCartUpdated } from "@/lib/cart-client-sync";

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
export function dispatchGroupOrderEndCartSnapshot(cart: Cart | null): void {
  dispatchCartUpdated({ cart: buildPostEndCartClientSnapshot(cart), source: "group-order-ended" });
}
