import type { Cart } from "@/domain/types";

export const CART_UPDATED_EVENT = "mennyu:cart-updated";

export type CartUpdatedDetail = {
  cart?: Cart | null;
  /** When true, listeners should refetch (e.g. unknown mutation). */
  refresh?: boolean;
};

/** Push cart snapshot to Quick Cart and header badge without GET /api/cart. */
export function dispatchCartUpdated(detail: CartUpdatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, { detail }));
  if (detail.cart) {
    window.dispatchEvent(new CustomEvent("mennyu:cart-added"));
  }
}

/** @deprecated Use dispatchCartUpdated({ cart }) */
export function dispatchCartItemAdded(): void {
  dispatchCartUpdated({});
}
