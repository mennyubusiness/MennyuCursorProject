import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getQuickCartPayload,
  getCartById,
  addCartItem,
  updateCartItem,
  removeCartItem,
  CartValidationError,
} from "@/services/cart.service";
import { prisma } from "@/lib/db";
import { buildCurrentPodCookieHeader } from "@/lib/session";
import {
  assertCartSessionAccess,
  resolveGroupOrderActorFromRequest,
} from "@/lib/cart-session-access";
import {
  GROUP_ORDER_PARTICIPANT_ID_COOKIE,
  GROUP_ORDER_JOIN_TOKEN_COOKIE,
} from "@/lib/group-order-cookies";
import { getOrSetSessionId, buildSessionCookieHeader, getSessionIdFromRequest } from "@/lib/session";
import {
  isCartApiMutationsEnabled,
  rejectDisabledCartApiMutation,
} from "@/lib/cart-api-mutations-gate";

async function resolveAuthUserId(): Promise<string | null> {
  const authSession = await auth();
  return authSession?.user?.id ?? null;
}

async function denyCartAccess(
  access: Extract<Awaited<ReturnType<typeof assertCartSessionAccess>>, { ok: false }>
) {
  return NextResponse.json({ error: access.error }, { status: access.status });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const browsePodId = searchParams.get("browsePodId") ?? searchParams.get("podId");
  const cartId = searchParams.get("cartId");
  if (cartId) {
    const sessionId = getSessionIdFromRequest(request);
    const authUserId = await resolveAuthUserId();
    const groupOrderActor = await resolveGroupOrderActorFromRequest(request, cartId, "read");
    const access = await assertCartSessionAccess(cartId, sessionId, {
      groupOrderActor,
      authUserId,
      mode: "read",
    });
    if (!access.ok) return denyCartAccess(access);
    const cart = await getCartById(cartId, groupOrderActor);
    if (!cart) {
      return NextResponse.json({ error: "Cart not found or access denied" }, { status: 403 });
    }
    return NextResponse.json(cart);
  }
  const { sessionId, isNew } = getOrSetSessionId(request);
  const authSession = await auth();
  const payload = await getQuickCartPayload(sessionId, browsePodId?.trim() || null, {
    markers: {
      participantId: request.cookies.get(GROUP_ORDER_PARTICIPANT_ID_COOKIE)?.value ?? null,
      legacyJoinToken: request.cookies.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null,
    },
    hostUserId: authSession?.user?.id ?? null,
  });
  const res = NextResponse.json(payload);
  if (isNew) res.headers.set("Set-Cookie", buildSessionCookieHeader(sessionId));
  return res;
}

/**
 * Legacy REST cart line mutations (add / update / remove).
 * First-party UI mutates carts via `cart.actions` Server Actions, which include stale
 * cart/session recovery. These handlers remain behind ENABLE_CART_API_MUTATIONS for
 * exceptional integrations only.
 */
export async function POST(request: NextRequest) {
  if (!isCartApiMutationsEnabled()) {
    return rejectDisabledCartApiMutation("POST");
  }
  const body = await request.json();
  const { cartId, menuItemId, quantity = 1, specialInstructions, selections } = body;
  if (!cartId || !menuItemId) {
    return NextResponse.json({ error: "cartId and menuItemId required" }, { status: 400 });
  }

  const sessionId = getSessionIdFromRequest(request);
  const authUserId = await resolveAuthUserId();
  const groupOrderActor = await resolveGroupOrderActorFromRequest(request, cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor,
    authUserId,
    mode: "mutate",
  });
  if (!access.ok) return denyCartAccess(access);

  try {
    const itemsBefore = await prisma.cartItem.count({ where: { cartId } });
    const cart = await addCartItem(
      cartId,
      menuItemId,
      Number(quantity) || 1,
      specialInstructions ?? null,
      selections ?? null,
      groupOrderActor
    );
    const res = NextResponse.json(cart);
    if (itemsBefore === 0 && cart.items.length > 0) {
      res.headers.append("Set-Cookie", buildCurrentPodCookieHeader(cart.podId));
    }
    return res;
  } catch (e) {
    if (e instanceof CartValidationError) {
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          ...(e.details && {
            cartItemId: e.details.cartItemId,
            menuItemId: e.details.menuItemId,
            menuItemName: e.details.menuItemName,
          }),
        },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** @see POST — legacy; prefer cart.actions. Gated by ENABLE_CART_API_MUTATIONS. */
export async function PATCH(request: NextRequest) {
  if (!isCartApiMutationsEnabled()) {
    return rejectDisabledCartApiMutation("PATCH");
  }
  const body = await request.json();
  const { cartId, cartItemId, quantity, specialInstructions, selections } = body;
  if (!cartId || !cartItemId) {
    return NextResponse.json({ error: "cartId and cartItemId required" }, { status: 400 });
  }

  const sessionId = getSessionIdFromRequest(request);
  const authUserId = await resolveAuthUserId();
  const groupOrderActor = await resolveGroupOrderActorFromRequest(request, cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor,
    authUserId,
    mode: "mutate",
  });
  if (!access.ok) return denyCartAccess(access);

  try {
    const cart = await updateCartItem(
      cartId,
      cartItemId,
      Number(quantity) ?? 0,
      specialInstructions ?? null,
      selections ?? null,
      groupOrderActor
    );
    return NextResponse.json(cart);
  } catch (e) {
    if (e instanceof CartValidationError) {
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          ...(e.details && {
            cartItemId: e.details.cartItemId,
            menuItemId: e.details.menuItemId,
            menuItemName: e.details.menuItemName,
          }),
        },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** @see POST — legacy; prefer cart.actions. Gated by ENABLE_CART_API_MUTATIONS. */
export async function DELETE(request: NextRequest) {
  if (!isCartApiMutationsEnabled()) {
    return rejectDisabledCartApiMutation("DELETE");
  }
  const { searchParams } = new URL(request.url);
  const cartId = searchParams.get("cartId");
  const cartItemId = searchParams.get("cartItemId");
  if (!cartId || !cartItemId) {
    return NextResponse.json({ error: "cartId and cartItemId required" }, { status: 400 });
  }

  const sessionId = getSessionIdFromRequest(request);
  const authUserId = await resolveAuthUserId();
  const groupOrderActor = await resolveGroupOrderActorFromRequest(request, cartId);
  const access = await assertCartSessionAccess(cartId, sessionId, {
    groupOrderActor,
    authUserId,
    mode: "mutate",
  });
  if (!access.ok) return denyCartAccess(access);

  try {
    const cart = await removeCartItem(cartId, cartItemId, groupOrderActor);
    return NextResponse.json(cart);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
