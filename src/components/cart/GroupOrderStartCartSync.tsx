"use client";

import { useEffect, useRef } from "react";
import { dispatchGroupOrderStartCartSnapshot } from "@/lib/group-order-start-sync";
import type { Cart } from "@/domain/types";

/** One-shot client sync after server-side group start (cart page redirect or SSR). */
export function GroupOrderStartCartSync({ cart }: { cart: Cart }) {
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    if (cart.groupOrder?.role !== "host" || !cart.groupOrder.joinCode) return;
    syncedRef.current = true;
    dispatchGroupOrderStartCartSnapshot(cart);
  }, [cart]);

  return null;
}
