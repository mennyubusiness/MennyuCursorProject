"use client";

import { useEffect, useRef } from "react";
import type { Cart } from "@/domain/types";
import { dispatchGroupOrderEndCartSnapshot } from "@/lib/group-order-end-sync";

/** One-shot client sync after server-side host group end (form redirect or SSR). */
export function GroupOrderEndCartSync({ cart }: { cart: Cart | null }) {
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    dispatchGroupOrderEndCartSnapshot(cart);
  }, [cart]);

  return null;
}
