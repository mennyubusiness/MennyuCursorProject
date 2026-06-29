"use client";

import { updateCartItemAction, removeFromCartAction } from "@/actions/cart.actions";
import type { CartUpdateSource } from "@/lib/cart-client-sync";
import type { Cart } from "@/domain/types";
import {
  optimisticDecrementCartItem,
  optimisticIncrementCartItem,
  optimisticRemoveCartItem,
  optimisticUpdateCartItemQuantity,
} from "@/lib/cart-optimistic";
import {
  runOptimisticCartMutation,
  type CartMutationResult,
} from "@/lib/cart-optimistic-mutations";

async function normalizeCartActionResult(
  result: CartMutationResult | null | undefined,
  fallbackError = "We couldn't update your cart. Please try again."
): Promise<CartMutationResult> {
  if (!result) {
    return { success: false, error: fallbackError };
  }
  return result;
}

export type CartLineMutationBase = {
  cartId: string;
  podId: string;
  cartItemId: string;
  source: CartUpdateSource;
  getCurrentCart: () => Cart;
  applyLocal?: (cart: Cart) => void;
  setError?: (message: string | null) => void;
  specialInstructions?: string | null;
};

export function optimisticIncrementCartItemMutation(
  params: CartLineMutationBase
): Promise<CartMutationResult> {
  return runOptimisticCartMutation({
    ...params,
    applyOptimistic: (cart) => optimisticIncrementCartItem(cart, params.cartItemId),
    runServer: async () => {
      const line = params.getCurrentCart().items.find((item) => item.id === params.cartItemId);
      if (!line) {
        return { success: false, error: "This item is no longer in your cart." };
      }
      return normalizeCartActionResult(
        await updateCartItemAction(
          params.cartId,
          params.cartItemId,
          line.quantity,
          params.specialInstructions ?? null,
          undefined,
          params.podId
        )
      );
    },
  });
}

export function optimisticDecrementCartItemMutation(
  params: CartLineMutationBase
): Promise<CartMutationResult> {
  return runOptimisticCartMutation({
    ...params,
    applyOptimistic: (cart) => optimisticDecrementCartItem(cart, params.cartItemId),
    runServer: async () => {
      const line = params.getCurrentCart().items.find((item) => item.id === params.cartItemId);
      if (!line) {
        return normalizeCartActionResult(
          await removeFromCartAction(params.cartId, params.cartItemId, params.podId)
        );
      }
      return normalizeCartActionResult(
        await updateCartItemAction(
          params.cartId,
          params.cartItemId,
          line.quantity,
          params.specialInstructions ?? null,
          undefined,
          params.podId
        )
      );
    },
  });
}

export function optimisticRemoveCartItemMutation(
  params: Omit<CartLineMutationBase, "specialInstructions">
): Promise<CartMutationResult> {
  return runOptimisticCartMutation({
    ...params,
    applyOptimistic: (cart) => optimisticRemoveCartItem(cart, params.cartItemId),
    runServer: async () =>
      normalizeCartActionResult(
        await removeFromCartAction(params.cartId, params.cartItemId, params.podId)
      ),
  });
}

export function optimisticSetCartItemQuantityMutation(
  params: CartLineMutationBase & { quantity: number }
): Promise<CartMutationResult> {
  const { quantity, ...base } = params;
  return runOptimisticCartMutation({
    ...base,
    applyOptimistic: (cart) => optimisticUpdateCartItemQuantity(cart, base.cartItemId, quantity),
    runServer: async () => {
      if (quantity <= 0) {
        return normalizeCartActionResult(
          await removeFromCartAction(base.cartId, base.cartItemId, base.podId)
        );
      }
      return normalizeCartActionResult(
        await updateCartItemAction(
          base.cartId,
          base.cartItemId,
          quantity,
          base.specialInstructions ?? null,
          undefined,
          base.podId
        )
      );
    },
  });
}
