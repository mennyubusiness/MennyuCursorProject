"use client";

import { useEffect, useRef } from "react";
import {
  clearMennyuCheckoutCookieClient,
  consumePendingClientCartClear,
  dispatchCartCleared,
  emptyCartSnapshot,
  readMennyuCheckoutCookie,
} from "@/lib/cart-client-sync";

/**
 * After a paid order loads, sync server cart cleanup (route handler) and empty Quick Cart / vendor menu state.
 * Failures are non-fatal — the order page must still render.
 */
export function OrderPostCheckoutCartSync({
  orderId,
  podId,
  orderStatus,
}: {
  orderId: string;
  podId: string;
  orderStatus: string;
}) {
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    if (orderStatus === "pending_payment") return;

    syncedRef.current = true;

    void (async () => {
      let serverCartId: string | null = null;
      let serverPodId = podId;

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/post-checkout-sync`, {
          method: "POST",
          credentials: "same-origin",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          cartId?: string | null;
          podId?: string;
        };
        if (data.ok) {
          serverCartId = data.cartId ?? null;
          if (data.podId) serverPodId = data.podId;
        }
      } catch {
        /* best-effort; client sync below still runs */
      }

      const pending = consumePendingClientCartClear(orderId);
      const checkoutCookie = readMennyuCheckoutCookie();
      const checkoutMatch =
        checkoutCookie?.orderId === orderId
          ? { cartId: checkoutCookie.cartId, podId, orderId }
          : null;
      const target =
        pending ??
        checkoutMatch ??
        (serverCartId
          ? { cartId: serverCartId, podId: serverPodId, orderId }
          : null);

      if (checkoutMatch || serverCartId) {
        clearMennyuCheckoutCookieClient();
      }

      if (!target) return;

      dispatchCartCleared({
        cartId: target.cartId,
        podId: target.podId || podId,
        cart: emptyCartSnapshot({ id: target.cartId, podId: target.podId || podId }),
        source: "order-page",
      });
    })();
  }, [orderId, podId, orderStatus]);

  return null;
}
