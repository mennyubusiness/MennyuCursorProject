"use client";

import { useState } from "react";
import { updateCartItemAction, removeFromCartAction } from "@/actions/cart.actions";
import { notifyQuickCartUpdated } from "@/components/cart/QuickCartContext";
import { applyCartMutationClientResult } from "@/lib/cart-mutation-client-result";
import { enqueueCartMutation } from "@/lib/cart-mutation-queue";

type QuickCartLineControlsProps = {
  cartId: string;
  podId: string;
  cartItemId: string;
  quantity: number;
  onUpdated: (cart: import("@/domain/types").Cart | null) => void | Promise<void>;
};

export function QuickCartLineControls({
  cartId,
  podId,
  cartItemId,
  quantity,
  onUpdated,
}: QuickCartLineControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setQty(next: number) {
    setLoading(true);
    setError(null);
    try {
      if (next <= 0) {
        const result = await enqueueCartMutation(cartId, () =>
          removeFromCartAction(cartId, cartItemId, podId)
        );
        if (
          applyCartMutationClientResult({
            result,
            applyCart: (cart) => {
              notifyQuickCartUpdated(cart);
            },
            setError,
          })
        ) {
          await onUpdated(result.success ? result.cart : null);
        } else if (!result.success && result.cart) {
          await onUpdated(result.cart);
        }
        return;
      }

      const result = await enqueueCartMutation(cartId, () =>
        updateCartItemAction(cartId, cartItemId, next, null, undefined, podId)
      );
      if (
        applyCartMutationClientResult({
          result: result ?? undefined,
          applyCart: (cart) => {
            notifyQuickCartUpdated(cart);
          },
          setError,
        })
      ) {
        await onUpdated(result!.success ? result!.cart : null);
      } else if (result && !result.success && result.cart) {
        await onUpdated(result.cart);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      {error ? (
        <p className="max-w-[10rem] text-right text-[10px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
