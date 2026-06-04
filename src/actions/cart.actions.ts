"use server";

// Cart session: use `@/lib/session-request` only — do not mint UUIDs here.

import { cookies } from "next/headers";
import {
  getOrCreateCart,
  getCartById,
  getOrCreateCartForVendorMenuPage,
  getCartByIdForMutation,
  addCartItem,
  updateCartItem,
  removeCartItem,
  CartValidationError,
} from "@/services/cart.service";
import type { AddToCartResult, UpdateCartItemResult, CartItemSelectionInput } from "./cart.actions.types";
import { revalidatePath } from "next/cache";
import { getMennyuSessionIdForRequest, getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { resolveActiveGroupCartIdForPod } from "@/services/group-order.service";
import { auth } from "@/auth";
import type { ResolvedGroupCartActor } from "@/services/group-order.service";
import { resolveGroupOrderActorForCartMutation } from "@/actions/group-order-context";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

type CartActionAccessDenied = {
  ok: false;
  error: string;
  code: "CART_ACCESS_DENIED" | "SESSION_REQUIRED";
};

async function assertCartAccessForAction(
  cartId: string,
  mode: "read" | "mutate"
): Promise<{ ok: true; actor: ResolvedGroupCartActor | null } | CartActionAccessDenied> {
  const sessionId = await getMennyuSessionIdForRequest();
  const actor = await resolveGroupOrderActorForCartMutation(cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor: actor,
    mode,
  });
  if (!access.ok) {
    return {
      ok: false,
      error: access.error,
      code: access.status === 401 ? "SESSION_REQUIRED" : "CART_ACCESS_DENIED",
    };
  }
  return { ok: true, actor };
}

export async function getOrCreateCartForVendorMenuAction(podId: string) {
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  const authSession = await auth();
  const sharedCartId = await resolveActiveGroupCartIdForPod(podId, {
    markers,
    hostUserId: authSession?.user?.id ?? null,
  });
  if (sharedCartId) {
    const access = await assertCartAccessForAction(sharedCartId, "read");
    if (access.ok) {
      const cart = await getCartByIdForMutation(sharedCartId, access.actor);
      if (cart) return cart;
    }
  }
  const sessionId = await getOrCreateMennyuSessionIdForCart();
  return getOrCreateCartForVendorMenuPage(podId, sessionId);
}

export async function getOrCreateCartAction(podId: string) {
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  const authSession = await auth();
  const sharedCartId = await resolveActiveGroupCartIdForPod(podId, {
    markers,
    hostUserId: authSession?.user?.id ?? null,
  });
  if (sharedCartId) {
    const access = await assertCartAccessForAction(sharedCartId, "read");
    if (access.ok) {
      const cart = await getCartById(sharedCartId, access.actor);
      if (cart) return cart;
    }
  }
  const sessionId = await getOrCreateMennyuSessionIdForCart();
  return getOrCreateCart(podId, sessionId);
}

export async function getCartAction(cartId: string) {
  const access = await assertCartAccessForAction(cartId, "read");
  if (!access.ok) return null;
  return getCartById(cartId);
}

export async function addToCartAction(
  cartId: string,
  menuItemId: string,
  quantity: number = 1,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null
): Promise<AddToCartResult> {
  if (DEBUG_ADD_TO_CART_TRACE) {
    console.log("[addToCartAction] enter", {
      cartId,
      menuItemId,
      quantity,
      hasSelections: Boolean(selections?.length),
    });
  }
  const access = await assertCartAccessForAction(cartId, "mutate");
  if (!access.ok) {
    return { success: false, error: access.error, code: access.code };
  }
  try {
    const cart = await addCartItem(
      cartId,
      menuItemId,
      quantity,
      specialInstructions,
      selections,
      access.actor
    );
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.log("[addToCartAction] addCartItem ok", {
        cartId: cart.id,
        podId: cart.podId,
        itemCount: cart.items.length,
      });
    }
    revalidatePath("/cart");
    return { success: true, cart };
  } catch (e) {
    if (e instanceof CartValidationError) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.warn("[addToCartAction] CartValidationError", {
          code: e.code,
          message: e.message,
          details: e.details,
        });
      }
      return {
        success: false,
        error: e.message,
        code: e.code,
        ...e.details,
      };
    }
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.error("[addToCartAction] non-validation error (rethrowing)", e);
    }
    throw e;
  }
}

export async function updateCartItemAction(
  cartId: string,
  cartItemId: string,
  quantity: number,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null
): Promise<UpdateCartItemResult | null> {
  const access = await assertCartAccessForAction(cartId, "mutate");
  if (!access.ok) {
    return { success: false, error: access.error, code: access.code };
  }
  try {
    const cart = await updateCartItem(
      cartId,
      cartItemId,
      quantity,
      specialInstructions,
      selections,
      access.actor
    );
    if (cart) {
      revalidatePath("/cart");
      return { success: true, cart };
    }
    return null;
  } catch (e) {
    if (e instanceof CartValidationError) {
      return {
        success: false,
        error: e.message,
        code: e.code,
        ...e.details,
      };
    }
    throw e;
  }
}

export async function removeFromCartAction(cartId: string, cartItemId: string) {
  const access = await assertCartAccessForAction(cartId, "mutate");
  if (!access.ok) return null;
  await removeCartItem(cartId, cartItemId, access.actor);
  revalidatePath("/cart");
  return getCartById(cartId);
}
