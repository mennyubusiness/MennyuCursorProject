import type { Cart } from "@/domain/types";

export const CART_SYNC_REQUIRED_MESSAGE = "We refreshed your cart. Please try again.";
export const CART_ITEM_NOT_IN_CART_MESSAGE = "This item is no longer in your cart.";

export type CartMutationFailureResult = {
  success: false;
  error: string;
  code?: string;
  cart?: Cart;
};

export type CartMutationSuccessResult = {
  success: true;
  cart: Cart;
  recoveredCart?: boolean;
};

/**
 * Apply server cart mutation results on the client (vendor menu, cart page, Quick Cart).
 * Returns true when the mutation succeeded; always applies authoritative snapshots when provided.
 */
export function applyCartMutationClientResult(params: {
  result:
    | CartMutationSuccessResult
    | CartMutationFailureResult
    | null
    | undefined;
  applyCart: (cart: Cart) => void;
  setError?: (message: string) => void;
  fallbackError?: string;
}): boolean {
  const { result, applyCart, setError, fallbackError = "We couldn't update your cart. Please try again." } =
    params;

  if (!result) {
    setError?.(fallbackError);
    return false;
  }

  if (result.success) {
    applyCart(result.cart);
    return true;
  }

  if (result.cart) {
    applyCart(result.cart);
  }
  setError?.(result.error || fallbackError);
  return false;
}
