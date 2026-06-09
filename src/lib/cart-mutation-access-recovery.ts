import "server-only";

import { prisma } from "@/lib/db";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { getMennyuSessionIdForRequest, getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { resolveGroupOrderActorForCartMutation } from "@/actions/group-order-context";
import {
  resolveActiveGroupCartIdForPod,
  type ResolvedGroupCartActor,
} from "@/services/group-order.service";
import { getOrCreateCartForVendorMenuPage, getCartByIdForMutation } from "@/services/cart.service";
import { normalizedConfigurationKey } from "@/lib/cart-line-identity";
import type { Cart } from "@/domain/types";

const TERMINAL_GROUP_STATUSES = ["submitted", "ended", "expired"] as const;
const ACTIVE_GROUP_STATUSES = ["active", "locked_checkout"] as const;

const ACCESS_DENIED = "Cart not found or access denied";

export const CART_SYNC_REQUIRED_MESSAGE = "We refreshed your cart. Please try again.";
export const CART_ITEM_NOT_IN_CART_MESSAGE = "This item is no longer in your cart.";

/** Prod-safe fields only — logs in non-production environments. */
const DEBUG_CART_MUTATION_ACCESS = process.env.NODE_ENV !== "production";

export type CartAccessDenyReason =
  | "cart_not_found"
  | "session_required"
  | "session_mismatch"
  | "group_no_actor"
  | "group_checkout_forbidden"
  | "group_closed"
  | "unknown";

export type CartMutationAccessDiagnostic = {
  cartExists: boolean;
  cartPodId: string | null;
  cartSessionMatchesRequest: boolean;
  groupSessionStatus: string | null;
  denyReason: CartAccessDenyReason;
};

export type CartMutationRecoveryResult =
  | { kind: "use_cart"; cartId: string; recovered: boolean; actor: ResolvedGroupCartActor | null }
  | { kind: "blocked"; error: string; code: string };

export async function diagnoseCartMutationAccess(params: {
  cartId: string;
  requestSessionId: string | null;
  groupOrderActor: ResolvedGroupCartActor | null;
}): Promise<CartMutationAccessDiagnostic> {
  const cart = await prisma.cart.findUnique({
    where: { id: params.cartId },
    select: { id: true, sessionId: true, podId: true },
  });
  if (!cart) {
    return {
      cartExists: false,
      cartPodId: null,
      cartSessionMatchesRequest: false,
      groupSessionStatus: null,
      denyReason: "cart_not_found",
    };
  }

  const groupSession = await prisma.groupOrderSession.findUnique({
    where: { cartId: params.cartId },
    select: { status: true, hostUserId: true },
  });

  if (groupSession) {
    if (groupSession.status === "submitted" || groupSession.status === "ended" || groupSession.status === "expired") {
      return {
        cartExists: true,
        cartPodId: cart.podId,
        cartSessionMatchesRequest: false,
        groupSessionStatus: groupSession.status,
        denyReason: "group_closed",
      };
    }
    if (params.groupOrderActor && params.groupOrderActor.cartId === params.cartId) {
      return {
        cartExists: true,
        cartPodId: cart.podId,
        cartSessionMatchesRequest: false,
        groupSessionStatus: groupSession.status,
        denyReason: "unknown",
      };
    }
    return {
      cartExists: true,
      cartPodId: cart.podId,
      cartSessionMatchesRequest: false,
      groupSessionStatus: groupSession.status,
      denyReason: "group_no_actor",
    };
  }

  if (!params.requestSessionId?.trim()) {
    return {
      cartExists: true,
      cartPodId: cart.podId,
      cartSessionMatchesRequest: false,
      groupSessionStatus: null,
      denyReason: "session_required",
    };
  }

  const sessionMatches = cart.sessionId === params.requestSessionId.trim();
  return {
    cartExists: true,
    cartPodId: cart.podId,
    cartSessionMatchesRequest: sessionMatches,
    groupSessionStatus: null,
    denyReason: sessionMatches ? "unknown" : "session_mismatch",
  };
}

export function logCartMutationAccessDenied(params: {
  action: "addToCart" | "updateCartItem" | "removeFromCart";
  cartId: string;
  cartItemId?: string;
  menuItemId?: string | null;
  derivedPodId: string | null;
  requestSessionPresent: boolean;
  authUserId: string | null;
  diagnostic: CartMutationAccessDiagnostic;
  accessCode: string;
}): void {
  if (!DEBUG_CART_MUTATION_ACCESS) return;
  console.warn("[cart-mutation-access] denied", {
    action: params.action,
    cartId: params.cartId,
    cartItemId: params.cartItemId ?? null,
    menuItemId: params.menuItemId ?? null,
    derivedPodId: params.derivedPodId,
    requestSessionPresent: params.requestSessionPresent,
    authUserId: params.authUserId,
    cartExists: params.diagnostic.cartExists,
    cartPodId: params.diagnostic.cartPodId,
    cartSessionMatchesRequest: params.diagnostic.cartSessionMatchesRequest,
    groupSessionStatus: params.diagnostic.groupSessionStatus,
    denyReason: params.diagnostic.denyReason,
    accessCode: params.accessCode,
  });
}

export type CartLineFingerprint = {
  menuItemId: string;
  configurationKey: string;
  groupOrderParticipantId: string | null;
};

export type CartItemMutationResolveResult =
  | {
      status: "ready";
      cartId: string;
      cartItemId: string;
      actor: ResolvedGroupCartActor | null;
      recovered: boolean;
    }
  | { status: "sync_required"; cart: Cart; error: string; code: "CART_SYNC_REQUIRED" }
  | { status: "item_gone"; cart: Cart; error: string; code: "CART_ITEM_NOT_FOUND" }
  | { status: "blocked"; error: string; code: string };

export function cartSyncRequiredResult(cart: Cart): Extract<CartItemMutationResolveResult, { status: "sync_required" }> {
  return {
    status: "sync_required",
    cart,
    error: CART_SYNC_REQUIRED_MESSAGE,
    code: "CART_SYNC_REQUIRED",
  };
}

export async function loadCartLineFingerprint(
  cartId: string,
  cartItemId: string
): Promise<CartLineFingerprint | null> {
  const row = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId },
    select: {
      menuItemId: true,
      specialInstructions: true,
      groupOrderParticipantId: true,
      selections: { select: { modifierOptionId: true, quantity: true } },
    },
  });
  if (!row) return null;
  return {
    menuItemId: row.menuItemId,
    configurationKey: normalizedConfigurationKey(
      row.specialInstructions,
      row.selections.map((selection) => ({
        modifierOptionId: selection.modifierOptionId,
        quantity: selection.quantity,
      }))
    ),
    groupOrderParticipantId: row.groupOrderParticipantId,
  };
}

export async function findEquivalentCartLineId(
  cartId: string,
  fingerprint: CartLineFingerprint,
  actor: ResolvedGroupCartActor | null
): Promise<string | null> {
  const candidates = await prisma.cartItem.findMany({
    where: { cartId, menuItemId: fingerprint.menuItemId },
    select: {
      id: true,
      specialInstructions: true,
      groupOrderParticipantId: true,
      selections: { select: { modifierOptionId: true, quantity: true } },
    },
  });

  for (const candidate of candidates) {
    const key = normalizedConfigurationKey(
      candidate.specialInstructions,
      candidate.selections.map((selection) => ({
        modifierOptionId: selection.modifierOptionId,
        quantity: selection.quantity,
      }))
    );
    if (key !== fingerprint.configurationKey) continue;
    if ((candidate.groupOrderParticipantId ?? null) !== fingerprint.groupOrderParticipantId) continue;
    if (actor?.role === "participant" && candidate.groupOrderParticipantId !== actor.participantId) {
      continue;
    }
    return candidate.id;
  }

  return null;
}

async function resolvePodIdForMenuItem(
  menuItemId: string,
  opts: { podIdHint?: string | null; cartPodHint?: string | null }
): Promise<{ podId: string | null; vendorId: string | null }> {
  const item = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { vendorId: true },
  });
  if (!item) return { podId: null, vendorId: null };

  const hints = [opts.podIdHint, opts.cartPodHint].filter(
    (value): value is string => Boolean(value?.trim())
  );
  for (const podId of hints) {
    const inPod = await prisma.podVendor.findUnique({
      where: { podId_vendorId: { podId, vendorId: item.vendorId } },
      select: { podId: true },
    });
    if (inPod) return { podId, vendorId: item.vendorId };
  }

  const fallback = await prisma.podVendor.findFirst({
    where: { vendorId: item.vendorId },
    select: { podId: true },
  });
  return { podId: fallback?.podId ?? null, vendorId: item.vendorId };
}

async function loadCartPodHint(cartId: string): Promise<string | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { podId: true },
  });
  return cart?.podId ?? null;
}

async function checkCartMutationAccess(
  cartId: string
): Promise<{ ok: true; actor: ResolvedGroupCartActor | null } | { ok: false; actor: ResolvedGroupCartActor | null }> {
  const actor = await resolveGroupOrderActorForCartMutation(cartId);
  const sessionId = await getMennyuSessionIdForRequest();
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor: actor,
    mode: "mutate",
  });
  if (!access.ok) return { ok: false, actor };
  return { ok: true, actor };
}

function blockedForActiveGroupAccess(
  diagnostic: CartMutationAccessDiagnostic
): CartMutationRecoveryResult {
  if (
    diagnostic.groupSessionStatus &&
    TERMINAL_GROUP_STATUSES.includes(
      diagnostic.groupSessionStatus as (typeof TERMINAL_GROUP_STATUSES)[number]
    )
  ) {
    return { kind: "blocked", error: "This group order is closed.", code: "GROUP_ORDER_CLOSED" };
  }
  return {
    kind: "blocked",
    error: "Join this group order to change the cart.",
    code: "GROUP_ORDER_AUTH_REQUIRED",
  };
}

/**
 * Recover solo/group cart for a pod when menu item id is unavailable (update/remove).
 * Never falls back to solo cart while an active group order applies.
 */
export async function tryRecoverCartForPodMutation(params: {
  requestedCartId: string;
  podIdHint?: string | null;
  requestSessionId: string | null;
  authUserId: string | null;
  markers: GroupOrderParticipantMarkers;
}): Promise<CartMutationRecoveryResult> {
  const cartPodHint = await loadCartPodHint(params.requestedCartId);
  const podId = params.podIdHint?.trim() || cartPodHint;
  if (!podId) {
    return { kind: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  if (
    params.podIdHint?.trim() &&
    cartPodHint &&
    params.podIdHint.trim() !== cartPodHint
  ) {
    return { kind: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  const activeGroupCartId = await resolveActiveGroupCartIdForPod(podId, {
    markers: params.markers,
    hostUserId: params.authUserId,
  });

  if (activeGroupCartId) {
    const access = await checkCartMutationAccess(activeGroupCartId);
    if (access.ok) {
      return {
        kind: "use_cart",
        cartId: activeGroupCartId,
        recovered: activeGroupCartId !== params.requestedCartId,
        actor: access.actor,
      };
    }
    const diagnostic = await diagnoseCartMutationAccess({
      cartId: activeGroupCartId,
      requestSessionId: params.requestSessionId,
      groupOrderActor: access.actor,
    });
    return blockedForActiveGroupAccess(diagnostic);
  }

  const requestedGroup = await prisma.groupOrderSession.findUnique({
    where: { cartId: params.requestedCartId },
    select: { status: true },
  });

  if (requestedGroup) {
    if (
      TERMINAL_GROUP_STATUSES.includes(
        requestedGroup.status as (typeof TERMINAL_GROUP_STATUSES)[number]
      )
    ) {
      return { kind: "blocked", error: "This group order is closed.", code: "GROUP_ORDER_CLOSED" };
    }
    if (
      ACTIVE_GROUP_STATUSES.includes(
        requestedGroup.status as (typeof ACTIVE_GROUP_STATUSES)[number]
      )
    ) {
      return {
        kind: "blocked",
        error: "Join this group order to change the cart.",
        code: "GROUP_ORDER_AUTH_REQUIRED",
      };
    }
  }

  const sessionId = params.requestSessionId?.trim()
    ? params.requestSessionId.trim()
    : await getOrCreateMennyuSessionIdForCart();

  const soloCart = await getOrCreateCartForVendorMenuPage(podId, sessionId);
  const access = await checkCartMutationAccess(soloCart.id);
  if (!access.ok) {
    return { kind: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  return {
    kind: "use_cart",
    cartId: soloCart.id,
    recovered: soloCart.id !== params.requestedCartId,
    actor: access.actor,
  };
}

/**
 * Resolve cart + line ids for update/remove when the client may hold stale cart ids.
 */
export async function resolveCartItemMutationAccess(params: {
  requestedCartId: string;
  cartItemId: string;
  podIdHint?: string | null;
  requestSessionId: string | null;
  authUserId: string | null;
  markers: GroupOrderParticipantMarkers;
  action: "updateCartItem" | "removeFromCart";
}): Promise<CartItemMutationResolveResult> {
  const access = await checkCartMutationAccess(params.requestedCartId);

  if (access.ok) {
    const lineOnCart = await prisma.cartItem.findFirst({
      where: { id: params.cartItemId, cartId: params.requestedCartId },
      select: { id: true },
    });
    if (lineOnCart) {
      return {
        status: "ready",
        cartId: params.requestedCartId,
        cartItemId: params.cartItemId,
        actor: access.actor,
        recovered: false,
      };
    }

    const currentCart = await getCartByIdForMutation(params.requestedCartId, access.actor);
    if (!currentCart) {
      return { status: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
    }
    return {
      status: "item_gone",
      cart: currentCart,
      error: CART_ITEM_NOT_IN_CART_MESSAGE,
      code: "CART_ITEM_NOT_FOUND",
    };
  }

  const staleFingerprint = await loadCartLineFingerprint(params.requestedCartId, params.cartItemId);
  const diagnostic = await diagnoseCartMutationAccess({
    cartId: params.requestedCartId,
    requestSessionId: params.requestSessionId,
    groupOrderActor: access.actor,
  });

  logCartMutationAccessDenied({
    action: params.action,
    cartId: params.requestedCartId,
    cartItemId: params.cartItemId,
    derivedPodId: params.podIdHint?.trim() ?? diagnostic.cartPodId,
    requestSessionPresent: Boolean(params.requestSessionId?.trim()),
    authUserId: params.authUserId,
    diagnostic,
    accessCode: "CART_ACCESS_DENIED",
  });

  const recovery = await tryRecoverCartForPodMutation({
    requestedCartId: params.requestedCartId,
    podIdHint: params.podIdHint,
    requestSessionId: params.requestSessionId,
    authUserId: params.authUserId,
    markers: params.markers,
  });

  if (recovery.kind === "blocked") {
    return { status: "blocked", error: recovery.error, code: recovery.code };
  }

  const recoveredCart = await getCartByIdForMutation(recovery.cartId, recovery.actor);
  if (!recoveredCart) {
    return { status: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  if (staleFingerprint) {
    const mappedLineId = await findEquivalentCartLineId(
      recovery.cartId,
      staleFingerprint,
      recovery.actor
    );
    if (mappedLineId) {
      return {
        status: "ready",
        cartId: recovery.cartId,
        cartItemId: mappedLineId,
        actor: recovery.actor,
        recovered: recovery.recovered || mappedLineId !== params.cartItemId,
      };
    }
  }

  return cartSyncRequiredResult(recoveredCart);
}

/**
 * When cart access fails on add, recover to the authoritative cart for this pod/context.
 * Never falls back to solo cart while an active group order applies.
 */
export async function tryRecoverCartForMutation(params: {
  requestedCartId: string;
  menuItemId: string;
  podIdHint?: string | null;
  requestSessionId: string | null;
  authUserId: string | null;
  markers: GroupOrderParticipantMarkers;
}): Promise<CartMutationRecoveryResult> {
  const cartPodHint = await loadCartPodHint(params.requestedCartId);
  const { podId } = await resolvePodIdForMenuItem(params.menuItemId, {
    podIdHint: params.podIdHint,
    cartPodHint,
  });

  if (!podId) {
    return { kind: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  if (params.podIdHint?.trim() && params.podIdHint.trim() !== podId) {
    return { kind: "blocked", error: ACCESS_DENIED, code: "CART_ACCESS_DENIED" };
  }

  return tryRecoverCartForPodMutation({
    requestedCartId: params.requestedCartId,
    podIdHint: podId,
    requestSessionId: params.requestSessionId,
    authUserId: params.authUserId,
    markers: params.markers,
  });
}
