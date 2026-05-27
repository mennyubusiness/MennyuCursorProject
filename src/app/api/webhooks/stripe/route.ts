import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import { processSuccessfulPayment } from "@/services/post-payment.service";
import {
  handleChargeRefundedWebhook,
  handleStripeRefundWebhookEvent,
  handleTransferReversedWebhook,
} from "@/services/stripe-refund-webhook.service";

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

  const markProcessed = async (errorMessage?: string) => {
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: !errorMessage,
        processedAt: errorMessage ? undefined : new Date(),
        errorMessage: errorMessage ?? null,
      },
    });
  };

  if (
    event.type === "refund.created" ||
    event.type === "refund.updated"
  ) {
    const refund = event.data.object as Stripe.Refund;
    try {
      await handleStripeRefundWebhookEvent(refund, {
        stripeRawJson: event.data.object as object,
      });
      await markProcessed();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markProcessed(message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    try {
      await handleChargeRefundedWebhook(charge, {
        stripeRawJson: event.data.object as object,
      });
      await markProcessed();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markProcessed(message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "transfer.reversed") {
    try {
      await handleTransferReversedWebhook(event.data.object as Stripe.Transfer);
      await markProcessed();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markProcessed(message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
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
      await processSuccessfulPayment({
        orderId,
        paymentIntentId: pi.id,
        idempotencyKey: `stripe_${event.id}`,
      });

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
