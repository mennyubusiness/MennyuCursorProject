/**
 * POST: Idempotent post-payment cart cleanup (DB source cart + checkout cookie).
 * Called from the order page client after confirmed payment — not during SSR.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";
import { getSessionIdFromRequest } from "@/lib/session";
import { prisma } from "@/lib/db";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";

export const dynamic = "force-dynamic";

async function readCheckoutCookieFromStore(
  orderId: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>
): Promise<{ cartId: string } | null> {
  const raw = cookieStore.get("mennyu_checkout")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { orderId?: string; cartId?: string };
    if (parsed.orderId === orderId && typeof parsed.cartId === "string") {
      return { cartId: parsed.cartId };
    }
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
  }

  const actorKey = getSessionIdFromRequest(request) ?? getClientIp(request);
  const limited = applyRateLimits([
    {
      key: rateLimitKeys.orderConfirmSession(actorKey),
      ...RATE_LIMITS.orderConfirmSession,
    },
  ]);
  if (limited) return limited;

  const access = await assertCustomerOrderAccess(orderId, request.headers);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, sourceCartId: true, podId: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  if (order.status === "pending_payment") {
    return NextResponse.json(
      { ok: false, code: "PENDING_PAYMENT", error: "Order is not paid yet." },
      { status: 409 }
    );
  }

  const cookieStore = await cookies();
  const checkoutCookie = await readCheckoutCookieFromStore(orderId, cookieStore);
  const cartId = order.sourceCartId ?? checkoutCookie?.cartId ?? null;

  await clearCheckoutSourceCartForOrder(orderId);
  cookieStore.delete("mennyu_checkout");

  return NextResponse.json({
    ok: true,
    cartId,
    podId: order.podId,
  });
}
