"use client";

import { useCallback, useState } from "react";
import { useQuickCart } from "@/components/cart/QuickCartContext";
import {
  optimisticDecrementCartItemMutation,
  optimisticIncrementCartItemMutation,
} from "@/lib/cart-optimistic-line-mutations";

type QuickCartLineControlsProps = {
  cartId: string;
  podId: string;
  cartItemId: string;
  quantity: number;
};

export function QuickCartLineControls({
  cartId,
  podId,
  cartItemId,
  quantity,
}: QuickCartLineControlsProps) {
  const { applyCartSnapshot, getCartSnapshot } = useQuickCart();
  const [error, setError] = useState<string | null>(null);

  const getCurrentCart = useCallback(() => {
    const current = getCartSnapshot();
    if (!current) {
      throw new Error("Quick Cart is not loaded.");
    }
    return current;
  }, [getCartSnapshot]);

  const applyLocal = useCallback(
    (next: import("@/domain/types").Cart) => {
      applyCartSnapshot(next);
    },
    [applyCartSnapshot]
  );

  const mutationBase = {
    cartId,
    podId,
    cartItemId,
    source: "quick-cart" as const,
    getCurrentCart,
    applyLocal,
    setError,
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-oo-light-stone bg-oo-cream">
        <button
          type="button"
          onClick={() => void optimisticDecrementCartItemMutation(mutationBase)}
          className="flex h-7 w-7 items-center justify-center rounded-l-md text-sm font-medium text-oo-charcoal hover:bg-oo-light-stone"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-oo-charcoal">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => void optimisticIncrementCartItemMutation(mutationBase)}
          className="flex h-7 w-7 items-center justify-center rounded-r-md text-sm font-medium text-oo-charcoal hover:bg-oo-light-stone"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      {error ? (
        <p className="max-w-[10rem] text-right text-[10px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
