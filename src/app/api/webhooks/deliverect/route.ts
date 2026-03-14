import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import {
  parseDeliverectWebhookBody,
  verifyDeliverectSignature,
  getDeliverectEventId,
  resolveWebhookStatusUpdate,
} from "@/integrations/deliverect/webhook-handler";
import { updateVendorOrderStatus } from "@/services/order-status.service";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const payload = parseDeliverectWebhookBody(body);
  const signature = request.headers.get("x-deliverect-signature") ?? request.headers.get("x-signature") ?? null;
  const secret = env.DELIVERECT_WEBHOOK_SECRET;

  if (!verifyDeliverectSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventId = getDeliverectEventId(payload);
  const idemKey = webhookIdempotencyKey("deliverect", eventId, body);

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    return NextResponse.json({ received: true, processed: existing.processed });
  }

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect",
      eventId: eventId ?? undefined,
      idempotencyKey: idemKey,
      payload: JSON.parse(body) as object,
    },
  });

  const { internalVendorOrderId, externalOrderId, update } = resolveWebhookStatusUpdate(payload);
  let vendorOrderId: string | null = null;
  if (internalVendorOrderId) {
    const byId = await prisma.vendorOrder.findUnique({
      where: { id: internalVendorOrderId },
      select: { id: true },
    });
    if (byId) vendorOrderId = byId.id;
  }
  if (!vendorOrderId && externalOrderId) {
    const byExternal = await prisma.vendorOrder.findFirst({
      where: { deliverectOrderId: externalOrderId },
      select: { id: true },
    });
    if (byExternal) vendorOrderId = byExternal.id;
  }
  if (!vendorOrderId) {
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: { processed: true, processedAt: new Date(), errorMessage: "Could not resolve vendor order (internal or external id)" },
    });
    return NextResponse.json({ received: true });
  }

  try {
    await updateVendorOrderStatus(
      vendorOrderId,
      update.routingStatus,
      update.fulfillmentStatus,
      "deliverect",
      payload
    );
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

  return NextResponse.json({ received: true });
}
