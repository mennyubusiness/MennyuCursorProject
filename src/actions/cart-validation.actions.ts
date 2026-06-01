"use server";

import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { buildCartForValidationFromDisplayCart } from "@/lib/cart-for-validation";
import type { CartPageValidationSnapshot } from "@/lib/cart-page-validation";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";
import { CART_DISPLAY_SESSION_CART_INCLUDE } from "@/services/cart.service";
import { validateCartItemsForDisplay } from "@/services/order.service";
import { resolveGroupOrderActorForCartMutation } from "@/actions/group-order-context";
import { prisma } from "@/lib/db";

export async function revalidateCartPageAction(
  cartId: string
): Promise<CartPageValidationSnapshot> {
  const sessionId = await getMennyuSessionIdForRequest();
  const actor = await resolveGroupOrderActorForCartMutation(cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor: actor,
    mode: "read",
  });
  if (!access.ok) {
    return {
      valid: false,
      errors: [
        {
          code: "CART_ACCESS_DENIED",
          message: "Could not revalidate your cart. Refresh the page and try again.",
        },
      ],
    };
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: CART_DISPLAY_SESSION_CART_INCLUDE,
  });

  if (!cart || cart.items.length === 0) {
    return { valid: true, errors: [] };
  }

  return validateCartItemsForDisplay(buildCartForValidationFromDisplayCart(cart));
}
