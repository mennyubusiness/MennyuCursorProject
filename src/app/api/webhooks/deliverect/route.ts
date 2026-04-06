import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logDeliverectOrderWebhook } from "@/integrations/deliverect/deliverect-webhook-structured-log";
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
import { persistDeliverectOrderWebhookRejection } from "./verification-audit";

function bodyShaPrefix(rawBody: string, n = 12): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, n);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = getDeliverectSignatureFromRequest(request);

  const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
  if (!parsedResult.ok) {
    logDeliverectOrderWebhook("invalid_json", {
      bodyLength: rawBody.length,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "invalid_json");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parsedResult.parsed;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret } = resolveDeliverectWebhookVerificationSecret(parsed, production);

  if (!verificationSecret) {
    logDeliverectOrderWebhook("verification_failed", {
      reason: "missing_verification_secret",
      production,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "missing_verification_secret");
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
    logDeliverectOrderWebhook("verification_failed", {
      reason: "bad_signature",
      production,
      hasSignature: Boolean(signature?.trim()),
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "bad_signature");
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
    logDeliverectOrderWebhook("duplicate_ignored", {
      idempotencyKey: idemKey,
      eventId: eventId ?? existing.eventId ?? null,
      processed: existing.processed,
      existingError: existing.errorMessage ?? null,
    });
    return NextResponse.json({
      received: true,
      duplicate: true,
      processed: existing.processed,
      eventId: existing.eventId ?? eventId ?? null,
      outcome: "duplicate" as const,
    });
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
    logDeliverectOrderWebhook("match_failed", {
      internalVendorOrderId: internalVendorOrderId ?? null,
      externalOrderId: externalOrderId ?? null,
      eventId: eventId ?? null,
      idempotencyKey: idemKey,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
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
      eventId: eventId ?? null,
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
    logDeliverectOrderWebhook("webhook_apply_error", {
      vendorOrderId,
      eventId: eventId ?? null,
      message,
      idempotencyKey: idemKey,
    });
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
    vendorOrderId: applyResult.vendorOrderId,
    orderId: applyResult.orderId,
    eventId: eventId ?? null,
  });
}
