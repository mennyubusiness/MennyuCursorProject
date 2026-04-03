import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import {
  verifyDeliverectSignature,
  getDeliverectEventId,
  resolveWebhookStatusUpdate,
  flattenDeliverectWebhookPayload,
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { applyDeliverectStatusWebhook } from "@/services/order-status.service";
import {
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  parseDeliverectWebhookJsonObject,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = getDeliverectSignatureFromRequest(request);

  const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
  if (!parsedResult.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parsedResult.parsed;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret } = resolveDeliverectWebhookVerificationSecret(parsed, production);

  if (!verificationSecret) {
    return NextResponse.json(
      {
        error: production
          ? "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing"
          : "Webhook verification failed: channelLinkId not found in payload (required for staging/sandbox HMAC)",
      },
      { status: 401 }
    );
  }

  const sigOk = verifyDeliverectSignature(rawBody, signature, verificationSecret, {
    nodeEnv: production ? "production" : "development",
    allowUnsignedDev: false,
  });
  if (!sigOk) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = parsed as DeliverectWebhookPayload;
  const flat = flattenDeliverectWebhookPayload(payload);
  const eventId = getDeliverectEventId(payload, flat, rawBody);
  const idemKey = webhookIdempotencyKey("deliverect", eventId, rawBody);

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true, processed: existing.processed });
  }

  const parsedPayload = parsed as object;

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
