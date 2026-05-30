import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIpFromHeaders } from "@/lib/rate-limit-http";
import { getSessionIdFromHeaders } from "@/lib/session";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { validatePaymentIntentForOrderProcessing } from "@/services/payment.service";
import { processSuccessfulPayment } from "@/services/post-payment.service";

const bodySchema = z.object({
  orderId: z.string(),
  paymentIntentId: z.string(),
  idempotencyKey: z.string().min(1),
});

/**
 * Client confirmation after Stripe payment succeeds (dev bypass or resume-payment flows).
 * Requires customer phone ownership and PaymentIntent validation before post-payment processing.
 * Stripe webhooks use the same processSuccessfulPayment path with signature auth instead.
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const actorKey = getSessionIdFromHeaders(headersList) ?? getClientIpFromHeaders(headersList);
    const limited = applyRateLimits([
      {
        key: rateLimitKeys.orderConfirmSession(actorKey),
        ...RATE_LIMITS.orderConfirmSession,
      },
    ]);
    if (limited) return limited;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { orderId, paymentIntentId, idempotencyKey } = parsed.data;

    const access = await assertCustomerOrderAccess(orderId, await headers());
    if (!access.ok) {
      return NextResponse.json({ error: access.error, code: "ACCESS_DENIED" }, { status: access.status });
    }

    const existing = await prisma.order.findFirst({
      where: { id: orderId, status: { not: "pending_payment" } },
    });
    if (existing) {
      await clearCheckoutSourceCartForOrder(orderId);
      return NextResponse.json({ orderId: existing.id, status: existing.status });
    }

    const validation = await validatePaymentIntentForOrderProcessing({
      orderId,
      paymentIntentId,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
        { status: validation.status }
      );
    }

    await processSuccessfulPayment({ orderId, paymentIntentId, idempotencyKey });

    const final = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!final) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ orderId: final.id, status: final.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order confirmation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
