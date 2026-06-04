import { NextRequest, NextResponse } from "next/server";
import { clearActiveSoloCartForSessionSwitch, clearCartForSession } from "@/services/cart.service";
import { getSessionIdFromRequest } from "@/lib/session";

/** Clear all items from the cart after successful checkout. Session must match (no cross-session clear). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cartId = body?.cartId;
    const switchPod = body?.switchPod === true || body?.switchPod === "true";
    if (!cartId || typeof cartId !== "string") {
      return NextResponse.json({ error: "cartId required" }, { status: 400 });
    }
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Session required" }, { status: 401 });
    }
    if (switchPod) {
      const result = await clearActiveSoloCartForSessionSwitch(cartId, sessionId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.message, code: result.code },
          { status: result.code === "GROUP_ORDER_ACTIVE" ? 409 : 404 }
        );
      }
      return NextResponse.json({ cleared: true, cartId });
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
