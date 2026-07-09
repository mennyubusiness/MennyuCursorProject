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
import type { AddToCartResult, UpdateCartItemResult, RemoveFromCartResult, CartItemSelectionInput, CartSyncBatchResult, CartSyncOperationInput } from "./cart.actions.types";
import { revalidatePath } from "next/cache";
import { getMennyuSessionIdForRequest, getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { resolveActiveGroupCartIdForPod } from "@/services/group-order.service";
import { auth } from "@/auth";
import type { ResolvedGroupCartActor } from "@/services/group-order.service";
import { resolveGroupOrderActorForCartMutation, resolveGroupOrderActorForCartRead } from "@/actions/group-order-context";
import {
  diagnoseCartMutationAccess,
  logCartMutationAccessDenied,
  resolveCartItemMutationAccess,
  tryRecoverCartForMutation,
} from "@/lib/cart-mutation-access-recovery";

import { isAddToCartTraceEnabled } from "@/lib/debug-add-to-cart-trace";

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
  const authSession = await auth();
  const actor =
    mode === "read"
      ? await resolveGroupOrderActorForCartRead(cartId)
      : await resolveGroupOrderActorForCartMutation(cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor: actor,
    authUserId: authSession?.user?.id ?? null,
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

async function prepareCartItemMutation(
  cartId: string,
  cartItemId: string,
  action: "updateCartItem" | "removeFromCart",
  podId?: string | null
): Promise<
  | { ok: true; cartId: string; cartItemId: string; actor: ResolvedGroupCartActor | null; recovered: boolean }
  | { ok: false; result: UpdateCartItemResult | RemoveFromCartResult }
> {
  const requestSessionId = await getMennyuSessionIdForRequest();
  const authSession = await auth();
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);

  const resolved = await resolveCartItemMutationAccess({
    requestedCartId: cartId,
    cartItemId,
    podIdHint: podId,
    requestSessionId,
    authUserId: authSession?.user?.id ?? null,
    markers,
    action,
  });

  if (resolved.status === "ready") {
    return {
      ok: true,
      cartId: resolved.cartId,
      cartItemId: resolved.cartItemId,
      actor: resolved.actor,
      recovered: resolved.recovered,
    };
  }

  if (resolved.status === "sync_required" || resolved.status === "item_gone") {
    return {
      ok: false,
      result: {
        success: false,
        error: resolved.error,
        code: resolved.code,
        cart: resolved.cart,
      },
    };
  }

  return {
    ok: false,
    result: { success: false, error: resolved.error, code: resolved.code },
  };
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
  return getOrCreateCartForVendorMenuPage(podId, sessionId, {
    authUserId: authSession?.user?.id ?? null,
  });
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
  return getOrCreateCart(podId, sessionId, { authUserId: authSession?.user?.id ?? null });
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
  selections?: CartItemSelectionInput[] | null,
  podId?: string | null
): Promise<AddToCartResult> {
  if (isAddToCartTraceEnabled()) {
    console.log("[addToCartAction] enter", {
      cartId,
      menuItemId,
      quantity,
      hasSelections: Boolean(selections?.length),
      podId: podId ?? null,
    });
  }

  let effectiveCartId = cartId;
  let recoveredCart = false;
  let access = await assertCartAccessForAction(effectiveCartId, "mutate");

  if (!access.ok) {
    const requestSessionId = await getMennyuSessionIdForRequest();
    const authSession = await auth();
    const store = await cookies();
    const markers = readGroupOrderParticipantMarkers(store);
    const actor = await resolveGroupOrderActorForCartMutation(effectiveCartId);
    const diagnostic = await diagnoseCartMutationAccess({
      cartId: effectiveCartId,
      requestSessionId,
      authUserId: authSession?.user?.id ?? null,
      groupOrderActor: actor,
    });
    logCartMutationAccessDenied({
      action: "addToCart",
      cartId: effectiveCartId,
      menuItemId,
      derivedPodId: podId?.trim() ?? diagnostic.cartPodId,
      requestSessionPresent: Boolean(requestSessionId?.trim()),
      authUserId: authSession?.user?.id ?? null,
      diagnostic,
      accessCode: access.code,
    });

    const recovery = await tryRecoverCartForMutation({
      requestedCartId: effectiveCartId,
      menuItemId,
      podIdHint: podId,
      requestSessionId,
      authUserId: authSession?.user?.id ?? null,
      markers,
    });

    if (recovery.kind === "use_cart") {
      effectiveCartId = recovery.cartId;
      recoveredCart = recovery.recovered;
      access = { ok: true, actor: recovery.actor };
    } else {
      return { success: false, error: recovery.error, code: recovery.code };
    }
  }

  try {
    const cart = await addCartItem(
      effectiveCartId,
      menuItemId,
      quantity,
      specialInstructions,
      selections,
      access.actor
    );
    if (isAddToCartTraceEnabled()) {
      console.log("[addToCartAction] addCartItem ok", {
        cartId: cart.id,
        podId: cart.podId,
        itemCount: cart.items.length,
        recoveredCart,
      });
    }
    revalidatePath("/cart");
    return { success: true, cart, ...(recoveredCart ? { recoveredCart: true } : {}) };
  } catch (e) {
    if (e instanceof CartValidationError) {
      if (isAddToCartTraceEnabled()) {
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
    if (isAddToCartTraceEnabled()) {
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
  selections?: CartItemSelectionInput[] | null,
  podId?: string | null
): Promise<UpdateCartItemResult | null> {
  const prepared = await prepareCartItemMutation(cartId, cartItemId, "updateCartItem", podId);
  if (!prepared.ok) {
    return prepared.result as UpdateCartItemResult;
  }

  try {
    const cart = await updateCartItem(
      prepared.cartId,
      prepared.cartItemId,
      quantity,
      specialInstructions,
      selections,
      prepared.actor
    );
    if (cart) {
      revalidatePath("/cart");
      return {
        success: true,
        cart,
        ...(prepared.recovered ? { recoveredCart: true } : {}),
      };
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

export async function removeFromCartAction(
  cartId: string,
  cartItemId: string,
  podId?: string | null
): Promise<RemoveFromCartResult> {
  const prepared = await prepareCartItemMutation(cartId, cartItemId, "removeFromCart", podId);
  if (!prepared.ok) {
    return prepared.result as RemoveFromCartResult;
  }

  try {
    const cart = await removeCartItem(prepared.cartId, prepared.cartItemId, prepared.actor);
    revalidatePath("/cart");
    return {
      success: true,
      cart,
      ...(prepared.recovered ? { recoveredCart: true } : {}),
    };
  } catch (e) {
    if (e instanceof CartValidationError) {
      return { success: false, error: e.message, code: e.code };
    }
    throw e;
  }
}

/**
 * Apply multiple cart operations in one request. Returns an authoritative cart snapshot
 * plus per-operation applied/rejected results. Validation rules match single-op actions.
 */
export async function syncCartBatchAction(
  cartId: string,
  operations: CartSyncOperationInput[],
  podId?: string | null
): Promise<CartSyncBatchResult> {
  const appliedOperations: Array<{ operationId: string; status: "applied" }> = [];
  const rejectedOperations: Array<{
    operationId: string;
    status: "rejected";
    reason: string;
    code?: string;
  }> = [];

  if (!Array.isArray(operations) || operations.length === 0) {
    const access = await assertCartAccessForAction(cartId, "read");
    if (!access.ok) {
      return {
        success: false,
        error: access.error,
        code: access.code,
        appliedOperations: [],
        rejectedOperations: [],
      };
    }
    const cart = await getCartById(cartId);
    if (!cart) {
      return {
        success: false,
        error: "Cart not found.",
        code: "CART_NOT_FOUND",
        appliedOperations: [],
        rejectedOperations: [],
      };
    }
    return { success: true, cart, appliedOperations: [], rejectedOperations: [] };
  }

  // Coalesce setQuantity/removeLine for the same cartItemId to the last intent.
  const coalesced: CartSyncOperationInput[] = [];
  const qtyIndexByItem = new Map<string, number>();
  for (const op of operations) {
    if (op.type === "setQuantity" || op.type === "removeLine") {
      const existing = qtyIndexByItem.get(op.cartItemId);
      if (existing != null) {
        coalesced[existing] = op;
      } else {
        qtyIndexByItem.set(op.cartItemId, coalesced.length);
        coalesced.push(op);
      }
      continue;
    }
    coalesced.push(op);
  }

  let effectiveCartId = cartId;
  let lastCart: Awaited<ReturnType<typeof getCartById>> = null;
  let fatalError: string | null = null;
  let fatalCode: string | undefined;

  for (const op of coalesced) {
    if (op.type === "addItem") {
      const result = await addToCartAction(
        effectiveCartId,
        op.menuItemId,
        op.quantity,
        op.specialInstructions,
        op.selections,
        podId
      );
      if (result.success) {
        effectiveCartId = result.cart.id;
        lastCart = result.cart;
        appliedOperations.push({ operationId: op.operationId, status: "applied" });
      } else {
        rejectedOperations.push({
          operationId: op.operationId,
          status: "rejected",
          reason: result.error,
          code: result.code,
        });
        if (result.code === "CART_ACCESS_DENIED" || result.code === "SESSION_REQUIRED") {
          fatalError = result.error;
          fatalCode = result.code;
          break;
        }
      }
      continue;
    }

    if (op.type === "removeLine") {
      const result = await removeFromCartAction(effectiveCartId, op.cartItemId, podId);
      if (result.success) {
        effectiveCartId = result.cart.id;
        lastCart = result.cart;
        appliedOperations.push({ operationId: op.operationId, status: "applied" });
      } else {
        rejectedOperations.push({
          operationId: op.operationId,
          status: "rejected",
          reason: result.error,
          code: result.code,
        });
        if (result.cart) lastCart = result.cart;
        if (result.code === "CART_ACCESS_DENIED" || result.code === "SESSION_REQUIRED") {
          fatalError = result.error;
          fatalCode = result.code;
          break;
        }
      }
      continue;
    }

    // setQuantity
    const result = await updateCartItemAction(
      effectiveCartId,
      op.cartItemId,
      op.quantity,
      op.specialInstructions ?? null,
      undefined,
      podId
    );
    if (!result) {
      rejectedOperations.push({
        operationId: op.operationId,
        status: "rejected",
        reason: "This item is no longer in your cart.",
        code: "ITEM_GONE",
      });
      continue;
    }
    if (result.success) {
      effectiveCartId = result.cart.id;
      lastCart = result.cart;
      appliedOperations.push({ operationId: op.operationId, status: "applied" });
    } else {
      rejectedOperations.push({
        operationId: op.operationId,
        status: "rejected",
        reason: result.error,
        code: result.code,
      });
      if (result.cart) lastCart = result.cart;
      if (result.code === "CART_ACCESS_DENIED" || result.code === "SESSION_REQUIRED") {
        fatalError = result.error;
        fatalCode = result.code;
        break;
      }
    }
  }

  if (!lastCart) {
    const cart = await getCartById(effectiveCartId);
    lastCart = cart;
  }

  if (fatalError) {
    return {
      success: false,
      error: fatalError,
      code: fatalCode,
      cart: lastCart ?? undefined,
      appliedOperations,
      rejectedOperations,
    };
  }

  if (!lastCart) {
    return {
      success: false,
      error: "Cart not found.",
      code: "CART_NOT_FOUND",
      appliedOperations,
      rejectedOperations,
    };
  }

  if (rejectedOperations.length > 0) {
    return {
      success: false,
      error:
        rejectedOperations.length === 1
          ? rejectedOperations[0]!.reason
          : "Some items could not be updated.",
      code: rejectedOperations[0]?.code,
      cart: lastCart,
      appliedOperations,
      rejectedOperations,
    };
  }

  return {
    success: true,
    cart: lastCart,
    appliedOperations,
    rejectedOperations,
  };
}
