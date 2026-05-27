"use client";

import { useState } from "react";
import { updateCartItemAction, removeFromCartAction } from "@/actions/cart.actions";
import { notifyQuickCartUpdated } from "@/components/cart/QuickCartContext";

type QuickCartLineControlsProps = {
  cartId: string;
  cartItemId: string;
  quantity: number;
  onUpdated: (cart: import("@/domain/types").Cart | null) => void | Promise<void>;
};

export function QuickCartLineControls({
  cartId,
  cartItemId,
  quantity,
  onUpdated,
}: QuickCartLineControlsProps) {
  const [loading, setLoading] = useState(false);

  async function setQty(next: number) {
    setLoading(true);
    try {
      if (next <= 0) {
        await removeFromCartAction(cartId, cartItemId);
        notifyQuickCartUpdated(null);
        await onUpdated(null);
        return;
      }
      const result = await updateCartItemAction(cartId, cartItemId, next, null);
      if (result?.success && result.cart) {
        notifyQuickCartUpdated(result.cart);
        await onUpdated(result.cart);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-oo-light-stone bg-oo-cream">
      <button
        type="button"
        disabled={loading}
        onClick={() => void setQty(quantity - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-l-md text-sm font-medium text-oo-charcoal hover:bg-oo-light-stone disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-oo-charcoal">
        {quantity}
      </span>
      <button
        type="button"
        disabled={loading}
        onClick={() => void setQty(quantity + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-r-md text-sm font-medium text-oo-charcoal hover:bg-oo-light-stone disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
