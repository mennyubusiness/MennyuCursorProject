"use client";

import { useEffect, useRef } from "react";
import {
  consumePendingClientCartClear,
  dispatchCartCleared,
  emptyCartSnapshot,
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
    if (!pending) return;

    syncedRef.current = true;
    dispatchCartCleared({
      cartId: pending.cartId,
      podId: pending.podId || podId,
      cart: emptyCartSnapshot({ id: pending.cartId, podId: pending.podId || podId }),
      source: "order-page",
    });
  }, [orderId, podId, orderStatus]);

  return null;
}
