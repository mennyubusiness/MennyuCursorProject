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
 * After Stripe redirect (or any checkout where client clear did not run inline),
 * consume the pending cart clear marker and empty Quick Cart / vendor menu state.
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

    const pending = consumePendingClientCartClear(orderId);
    const checkoutCookie = readMennyuCheckoutCookie();
    const checkoutMatch =
      checkoutCookie?.orderId === orderId
        ? { cartId: checkoutCookie.cartId, podId, orderId }
        : null;
    const target = pending ?? checkoutMatch;
    if (!target) return;

    syncedRef.current = true;
    if (checkoutMatch) {
      clearMennyuCheckoutCookieClient();
    }
    dispatchCartCleared({
      cartId: target.cartId,
      podId: target.podId || podId,
      cart: emptyCartSnapshot({ id: target.cartId, podId: target.podId || podId }),
      source: "order-page",
    });
  }, [orderId, podId, orderStatus]);

  return null;
}
