import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import { recordPaymentAndAllocations } from "@/services/payment.service";
import { setOrderStatus } from "@/services/order.service";
import { submitVendorOrderToDeliverect } from "@/services/deliverect.service";
import { sendOrderConfirmation } from "@/services/sms.service";
import { deriveParentRoutingStatusFromAttempts } from "@/domain/order-state";

export async function POST(request: NextRequest) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const idemKey = webhookIdempotencyKey("stripe", event.id, body);
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    if (existing.processed) {
      return NextResponse.json({ received: true });
    }
  } else {
    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId: event.id,
        idempotencyKey: idemKey,
        payload: JSON.parse(body) as object,
      },
    });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    if (!orderId) {
      await prisma.webhookEvent.updateMany({
        where: { idempotencyKey: idemKey },
        data: { processed: false, errorMessage: "Missing orderId in metadata" },
      });
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    try {
      await recordPaymentAndAllocations(orderId, pi.id, `stripe_${event.id}`);
      await setOrderStatus(orderId, "paid", "stripe");
      await setOrderStatus(orderId, "routing", "system");

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { vendorOrders: true },
      });
      if (order) {
        for (const vo of order.vendorOrders) {
          await submitVendorOrderToDeliverect(
            vo.id,
            order.customerPhone,
            order.customerEmail,
            15
          );
        }
        const updatedOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: { vendorOrders: { select: { routingStatus: true } } },
        });
        const routingStatus = deriveParentRoutingStatusFromAttempts(
          (updatedOrder?.vendorOrders ?? []).map((vo) => vo.routingStatus as "pending" | "sent" | "confirmed" | "failed")
        );
        await setOrderStatus(orderId, routingStatus, "system");
        await sendOrderConfirmation(order.customerPhone, orderId, order.totalCents);
      }

      await prisma.webhookEvent.updateMany({
        where: { idempotencyKey: idemKey },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.webhookEvent.updateMany({
        where: { idempotencyKey: idemKey },
        data: { processed: false, errorMessage: message },
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
