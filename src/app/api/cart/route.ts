import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateCart,
  getCartById,
  addCartItem,
  updateCartItem,
  removeCartItem,
  CartValidationError,
} from "@/services/cart.service";
import { getOrSetSessionId, buildSessionCookieHeader } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const podId = searchParams.get("podId");
  const cartId = searchParams.get("cartId");
  if (cartId) {
    const cart = await getCartById(cartId);
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    return NextResponse.json(cart);
  }
  if (!podId) {
    return NextResponse.json({ error: "podId or cartId required" }, { status: 400 });
  }
  const { sessionId, isNew } = getOrSetSessionId(request);
  const cart = await getOrCreateCart(podId, sessionId);
  const res = NextResponse.json(cart);
  if (isNew) res.headers.set("Set-Cookie", buildSessionCookieHeader(sessionId));
  return res;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cartId, menuItemId, quantity = 1, specialInstructions, selections } = body;
  if (!cartId || !menuItemId) {
    return NextResponse.json({ error: "cartId and menuItemId required" }, { status: 400 });
  }
  try {
    const cart = await addCartItem(
      cartId,
      menuItemId,
      Number(quantity) || 1,
      specialInstructions ?? null,
      selections ?? null
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

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { cartId, cartItemId, quantity, specialInstructions, selections } = body;
  if (!cartId || !cartItemId) {
    return NextResponse.json({ error: "cartId and cartItemId required" }, { status: 400 });
  }
  try {
    const cart = await updateCartItem(
      cartId,
      cartItemId,
      Number(quantity) ?? 0,
      specialInstructions ?? null,
      selections ?? null
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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cartId = searchParams.get("cartId");
  const cartItemId = searchParams.get("cartItemId");
  if (!cartId || !cartItemId) {
    return NextResponse.json({ error: "cartId and cartItemId required" }, { status: 400 });
  }
  try {
    const cart = await removeCartItem(cartId, cartItemId);
    return NextResponse.json(cart);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

