import "server-only";

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE } from "@/lib/group-order-cookies";
import {
  resolveActorForGroupCart,
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
    select: { id: true, sessionId: true, podId: true },
  });
  if (!cart) {
    return { ok: false, status: 403, error: ACCESS_DENIED };
  }

  const groupSession = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    select: { hostUserId: true, status: true },
  });

  if (groupSession) {
    if (mode === "checkout") {
      const uid = options.authUserId?.trim();
      if (!uid || uid !== groupSession.hostUserId) {
        return {
          ok: false,
          status: 403,
          error: "Only the host can check out a group order.",
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

  if (!currentSessionId?.trim()) {
    return { ok: false, status: 401, error: "Session required" };
  }
  if (cart.sessionId !== currentSessionId.trim()) {
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

/** Resolve group-order host/participant actor from route handler cookies + auth session. */
export async function resolveGroupOrderActorFromRequest(
  request: NextRequest,
  cartId: string
): Promise<ResolvedGroupCartActor | null> {
  const authSession = await auth();
  const joinToken = request.cookies.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;
  return resolveActorForGroupCart(cartId, {
    hostUserId: authSession?.user?.id ?? null,
    joinTokenFromCookie: joinToken,
  });
}
