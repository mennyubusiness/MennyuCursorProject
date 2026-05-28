import { dispatchCartUpdated } from "@/lib/cart-client-sync";
import type { Cart } from "@/domain/types";

/** Dispatches cart snapshot to shell UI (quick cart, header badge) without refetching. */
export function dispatchCartItemAdded(cart?: Cart): void {
  if (cart) {
    dispatchCartUpdated({ cart });
    return;
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mennyu:cart-added"));
}
