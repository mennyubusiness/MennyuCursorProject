"use server";

// Cart session: use `@/lib/session-request` only — do not mint UUIDs here.

import {
  getOrCreateCart,
  getCartById,
  addCartItem,
  updateCartItem,
  removeCartItem,
  CartValidationError,
} from "@/services/cart.service";
import type { AddToCartResult, UpdateCartItemResult, CartItemSelectionInput } from "./cart.actions.types";
import { revalidatePath } from "next/cache";
import { getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

export async function getOrCreateCartAction(podId: string) {
  const sessionId = await getOrCreateMennyuSessionIdForCart();
  return getOrCreateCart(podId, sessionId);
}

export async function getCartAction(cartId: string) {
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
  try {
    const cart = await addCartItem(cartId, menuItemId, quantity, specialInstructions, selections);
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.log("[addToCartAction] addCartItem ok", { cartId: cart.id, podId: cart.podId, itemCount: cart.items.length });
    }
    revalidatePath("/cart");
    revalidatePath(`/pod/${cart.podId}`, "layout");
    return { success: true, cart };
  } catch (e) {
    if (e instanceof CartValidationError) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.warn("[addToCartAction] CartValidationError", { code: e.code, message: e.message, details: e.details });
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
  try {
    const cart = await updateCartItem(cartId, cartItemId, quantity, specialInstructions, selections);
    if (cart) {
      revalidatePath("/cart");
      revalidatePath(`/pod/${cart.podId}`, "layout");
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
  const cart = await getCartById(cartId);
  await removeCartItem(cartId, cartItemId);
  if (cart) {
    revalidatePath("/cart");
    revalidatePath(`/pod/${cart.podId}`, "layout");
  }
  return getCartById(cartId);
}
