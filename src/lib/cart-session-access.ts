import "server-only";

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  GROUP_ORDER_JOIN_TOKEN_COOKIE,
  GROUP_ORDER_PARTICIPANT_ID_COOKIE,
} from "@/lib/group-order-cookies";
import {
  resolveActorForGroupCart,
  resolveGroupCartActorForRead,
  type ResolvedGroupCartActor,
} from "@/services/group-order.service";

export type CartSessionAccessResult =
  | { ok: true; cartId: string; sessionId: string; podId: string; isGroupOrder: boolean }
  | { ok: false; status: 401 | 403; error: string };

export type AssertCartSessionAccessOptions = {
  groupOrderActor?: ResolvedGroupCartActor | null;
  authUserId?: string | null;
  mode?: "read" | "mutate" | "checkout";
};

const ACCESS_DENIED = "Cart not found or access denied";

export const GROUP_ORDER_TERMINAL_CHECKOUT_MESSAGE =
  "This group order is closed. Start a new order or clear your cart to continue.";

function isTerminalGroupSessionStatus(status: string): boolean {
  return status === "ended" || status === "expired";
}

type SoloCartAccessRow = {
  id: string;
  sessionId: string;
  podId: string;
  userId: string | null;
};

function assertSoloCartAccess(
  cart: SoloCartAccessRow,
  currentSessionId: string | null,
  authUserId: string | null | undefined
): CartSessionAccessResult {
  const ownerId = cart.userId?.trim();
  if (ownerId) {
    const uid = authUserId?.trim();
    if (!uid || uid !== ownerId) {
      return { ok: false, status: 403, error: ACCESS_DENIED };
    }
    return {
      ok: true,
      cartId: cart.id,
      sessionId: cart.sessionId,
      podId: cart.podId,
      isGroupOrder: false,
    };
  }

  if (authUserId?.trim()) {
    return { ok: false, status: 403, error: ACCESS_DENIED };
  }

  if (!currentSessionId?.trim() || cart.sessionId !== currentSessionId.trim()) {
    return { ok: false, status: 403, error: ACCESS_DENIED };
  }

  return {
    ok: true,
    cartId: cart.id,
    sessionId: cart.sessionId,
    podId: cart.podId,
    isGroupOrder: false,
  };
}

/**
 * Verifies the caller may access a cart by id.
 * Solo carts: mennyu session must match cart.sessionId.
 * Group carts: host (auth) or participant (join cookie) via groupOrderActor; checkout is host-only.
 */
export async function assertCartSessionAccess(
  cartId: string,
  currentSessionId: string | null,
  options: AssertCartSessionAccessOptions = {}
): Promise<CartSessionAccessResult> {
  const mode = options.mode ?? "read";

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { id: true, sessionId: true, podId: true, userId: true },
  });
  if (!cart) {
    return { ok: false, status: 403, error: ACCESS_DENIED };
  }

  const groupSession = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    select: { hostUserId: true, status: true },
  });

  if (groupSession) {
    if (isTerminalGroupSessionStatus(groupSession.status)) {
      if (mode === "checkout") {
        return {
          ok: false,
          status: 403,
          error: GROUP_ORDER_TERMINAL_CHECKOUT_MESSAGE,
        };
      }
      if (mode === "mutate" && groupSession.status === "expired") {
        return {
          ok: false,
          status: 403,
          error: "This group order is closed.",
        };
      }
      return assertSoloCartAccess(cart, currentSessionId, options.authUserId);
    }

    if (mode === "checkout") {
      const uid = options.authUserId?.trim();
      if (!uid || uid !== groupSession.hostUserId) {
        return {
          ok: false,
          status: 403,
          error: "Only the host can check out for this group order.",
        };
      }
      if (groupSession.status !== "active" && groupSession.status !== "locked_checkout") {
        return { ok: false, status: 403, error: ACCESS_DENIED };
      }
      return {
        ok: true,
        cartId: cart.id,
        sessionId: cart.sessionId,
        podId: cart.podId,
        isGroupOrder: true,
      };
    }

    const actor = options.groupOrderActor;
    if (actor && actor.cartId === cartId) {
      return {
        ok: true,
        cartId: cart.id,
        sessionId: cart.sessionId,
        podId: cart.podId,
        isGroupOrder: true,
      };
    }

    return { ok: false, status: 403, error: ACCESS_DENIED };
  }

  if (!currentSessionId?.trim() && !options.authUserId?.trim()) {
    return { ok: false, status: 401, error: "Session required" };
  }

  return assertSoloCartAccess(cart, currentSessionId, options.authUserId);
}

/** Resolve group-order host/participant actor from route handler cookies + auth session. */
export async function resolveGroupOrderActorFromRequest(
  request: NextRequest,
  cartId: string,
  mode: "read" | "mutate" = "mutate"
): Promise<ResolvedGroupCartActor | null> {
  const authSession = await auth();
  const participantId = request.cookies.get(GROUP_ORDER_PARTICIPANT_ID_COOKIE)?.value ?? null;
  const legacyJoinToken = request.cookies.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;
  const opts = {
    hostUserId: authSession?.user?.id ?? null,
    participantIdFromCookie: participantId,
    joinTokenFromCookie: legacyJoinToken,
  };
  if (mode === "read") {
    return resolveGroupCartActorForRead(cartId, opts);
  }
  return resolveActorForGroupCart(cartId, opts);
}
