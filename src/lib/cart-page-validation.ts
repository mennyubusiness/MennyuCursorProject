import type { CartItemValidationError } from "@/services/order.service";

export type CartPageValidationSnapshot = {
  valid: boolean;
  errors: CartItemValidationError[];
};

export function buildErrorByCartItemId(
  errors: CartItemValidationError[],
  cartItems: Array<{ id: string; menuItemId: string }>
): Map<string, string> {
  const errorByCartItemId = new Map<string, string>();
  for (const e of errors) {
    if (e.cartItemId) {
      errorByCartItemId.set(e.cartItemId, e.message);
    } else if (e.menuItemId) {
      for (const item of cartItems) {
        if (item.menuItemId === e.menuItemId) {
          errorByCartItemId.set(item.id, e.message);
        }
      }
    }
  }
  return errorByCartItemId;
}

/** Drop validation errors for cart lines that no longer exist. */
export function pruneValidationForCart(
  validation: CartPageValidationSnapshot,
  cartItems: Array<{ id: string; menuItemId: string }>
): CartPageValidationSnapshot {
  if (cartItems.length === 0) {
    return { valid: true, errors: [] };
  }

  const cartItemIds = new Set(cartItems.map((i) => i.id));
  const menuItemIdsInCart = new Set(cartItems.map((i) => i.menuItemId));

  const prunedErrors = validation.errors.filter((e) => {
    if (e.cartItemId) {
      return cartItemIds.has(e.cartItemId);
    }
    if (e.menuItemId) {
      return menuItemIdsInCart.has(e.menuItemId);
    }
    return true;
  });

  return {
    valid: prunedErrors.length === 0,
    errors: prunedErrors,
  };
}

export function deriveCartPageCheckoutState(input: {
  cartItemCount: number;
  validation: CartPageValidationSnapshot;
}): { canCheckout: boolean; showWarning: boolean } {
  if (input.cartItemCount === 0) {
    return { canCheckout: false, showWarning: false };
  }
  const showWarning = input.validation.errors.length > 0;
  const canCheckout = input.validation.valid && input.validation.errors.length === 0;
  return { canCheckout, showWarning };
}

export function cartMutationFingerprint(
  items: Array<{ id: string; menuItemId: string; quantity: number; priceCents: number }>
): string {
  return items.map((i) => `${i.id}|${i.menuItemId}|${i.quantity}|${i.priceCents}`).join(";");
}
