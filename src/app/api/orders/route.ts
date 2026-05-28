import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { processSuccessfulPayment } from "@/services/post-payment.service";

const bodySchema = z.object({
  orderId: z.string(),
  paymentIntentId: z.string(),
  idempotencyKey: z.string().min(1),
});

/**
 * Called after Stripe payment succeeds (e.g. dev bypass or resume-payment client flows).
 * Delegates to processSuccessfulPayment (same as Stripe webhook): idempotent payment,
 * routing, and confirmation SMS only when payment is first recorded.
 * Accepts dev_bypass_* paymentIntentId in development for testing without Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { orderId, paymentIntentId, idempotencyKey } = parsed.data;

    const existing = await prisma.order.findFirst({
      where: { id: orderId, status: { not: "pending_payment" } },
    });
    if (existing) {
      await clearCheckoutSourceCartForOrder(orderId);
      return NextResponse.json({ orderId: existing.id, status: existing.status });
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
