import { NextRequest, NextResponse } from "next/server";
import { clearCartForSession } from "@/services/cart.service";
import { getSessionIdFromRequest } from "@/lib/session";

/** Clear all items from the cart after successful checkout. Session must match (no cross-session clear). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cartId = body?.cartId;
    if (!cartId || typeof cartId !== "string") {
      return NextResponse.json({ error: "cartId required" }, { status: 400 });
    }
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Session required" }, { status: 401 });
    }
    const cart = await clearCartForSession(cartId, sessionId);
    if (!cart) {
      return NextResponse.json({ error: "Cart not found or access denied" }, { status: 404 });
    }
    return NextResponse.json(cart);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Clear failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
