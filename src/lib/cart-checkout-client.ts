import type { Cart } from "@/domain/types";
import {
  dispatchCartCleared,
  emptyCartSnapshot,
  markPendingClientCartClear,
  PENDING_CART_CLEAR_STORAGE_KEY,
  type PendingCartClear,
} from "@/lib/cart-client-sync";

/** Remember which cart should be cleared client-side after this checkout order completes. */
export function rememberCheckoutCartForClientClear(payload: PendingCartClear): void {
  markPendingClientCartClear(payload);
}

/**
 * Clear server cart (best effort) and immediately clear Quick Cart / vendor menu client state.
 */
export async function clearCartOnServerAndNotifyClient(params: {
  cartId: string;
  podId: string;
  orderId?: string;
}): Promise<void> {
  let cleared: Cart | null = null;
  try {
    const res = await fetch("/api/cart/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: params.cartId }),
    });
    if (res.ok) {
      cleared = (await res.json()) as Cart;
    }
  } catch {
    /* order success path may have cleared server-side already */
  }

  dispatchCartCleared({
    cartId: params.cartId,
    podId: cleared?.podId ?? params.podId,
    cart: cleared ?? emptyCartSnapshot({ id: params.cartId, podId: params.podId }),
    source: "checkout",
  });

  if (params.orderId && typeof sessionStorage !== "undefined") {
    const raw = sessionStorage.getItem(PENDING_CART_CLEAR_STORAGE_KEY);
    if (raw) {
      try {
        const pending = JSON.parse(raw) as PendingCartClear;
        if (pending.orderId === params.orderId) {
          sessionStorage.removeItem(PENDING_CART_CLEAR_STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }
    }
  }
}
