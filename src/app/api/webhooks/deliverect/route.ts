import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import {
  parseDeliverectWebhookBody,
  verifyDeliverectSignature,
  getDeliverectEventId,
  resolveWebhookStatusUpdate,
  flattenDeliverectWebhookPayload,
} from "@/integrations/deliverect/webhook-handler";
import { applyDeliverectStatusWebhook } from "@/services/order-status.service";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const payload = parseDeliverectWebhookBody(body);
  const flat = flattenDeliverectWebhookPayload(payload);
  const signature =
    request.headers.get("x-deliverect-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("X-Deliverect-Hmac-Signature") ??
    null;

  if (!verifyDeliverectSignature(body, signature, env.DELIVERECT_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventId = getDeliverectEventId(payload, flat, body);
  const idemKey = webhookIdempotencyKey("deliverect", eventId, body);

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true, processed: existing.processed });
  }

  let parsedPayload: object;
  try {
    parsedPayload = JSON.parse(body) as object;
  } catch {
    parsedPayload = {};
  }

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect",
      eventId: eventId ?? undefined,
      idempotencyKey: idemKey,
      payload: parsedPayload,
    },
  });

  const { internalVendorOrderId, externalOrderId } = resolveWebhookStatusUpdate(payload);

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
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage:
          "match_failed: could not resolve vendor order (channelOrderId / mennyuVendorOrderId or deliverectOrderId)",
      },
    });
    return NextResponse.json({
      received: true,
      resolved: false,
      outcome: "match_failed" as const,
    });
  }

  let applyResult: Awaited<ReturnType<typeof applyDeliverectStatusWebhook>>;
  try {
    applyResult = await applyDeliverectStatusWebhook(vendorOrderId, externalOrderId, payload);
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: { processed: false, errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    resolved: true,
    outcome: applyResult.outcome,
    updatedVendorOrderState: applyResult.updatedVendorOrderState,
  });
}
