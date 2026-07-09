import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import {
  logProviderWebhookEvent,
  markProviderWebhookEventProcessed,
} from "@/lib/integrations/provider-webhook-event.service";
import {
  extractSquareWebhookEventMeta,
  parseSquareWebhookJson,
} from "@/lib/integrations/square/square-webhook-payload";
import {
  isSquareWebhookSignatureConfigured,
  resolveSquareWebhookNotificationUrl,
  verifySquareWebhookSignature,
} from "@/lib/integrations/square/square-webhook-verify";
import { syncSquareOrderStatusBySquareOrderId } from "@/services/square-status-sync.service";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isSquareWebhookSignatureConfigured()) {
    return NextResponse.json(
      {
        error: "Square status sync is not configured (missing SQUARE_WEBHOOK_SIGNATURE_KEY)",
        code: "square_webhook_not_configured",
      },
      { status: 503 }
    );
  }

  const notificationUrl = resolveSquareWebhookNotificationUrl();
  if (!notificationUrl) {
    return NextResponse.json(
      {
        error: "Square webhook notification URL is not configured",
        code: "square_webhook_notification_url_missing",
      },
      { status: 503 }
    );
  }

  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");
  const signatureValid = verifySquareWebhookSignature({
    rawBody,
    signatureHeader,
    notificationUrl,
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
  });

  if (!signatureValid) {
    await logProviderWebhookEvent({
      provider: "square",
      eventType: "signature_failed",
      payload: { bodyLength: rawBody.length },
      processingStatus: "failed",
      errorCode: "failed_signature",
      errorMessage: "Invalid Square webhook signature",
    }).catch(() => undefined);

    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const payload = parseSquareWebhookJson(rawBody);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meta = extractSquareWebhookEventMeta(payload);

  const logged = await logProviderWebhookEvent({
    provider: "square",
    externalEventId: meta.externalEventId,
    externalObjectId: meta.squareOrderId,
    eventType: meta.eventType,
    payload,
    processingStatus: "received",
  });

  if (!logged.created) {
    return NextResponse.json({
      received: true,
      duplicate: true,
      eventId: meta.externalEventId,
    });
  }

  if (meta.eventType !== "order.updated") {
    await markProviderWebhookEventProcessed(logged.id, "ignored", {
      code: "ignored_non_order_update",
      message: `Ignored event type ${meta.eventType}`,
    });
    return NextResponse.json({
      received: true,
      outcome: "ignored_non_order_update",
      eventType: meta.eventType,
    });
  }

  if (!meta.squareOrderId) {
    await markProviderWebhookEventProcessed(logged.id, "ignored", {
      code: "ignored_no_match",
      message: "order.updated missing Square order id",
    });
    return NextResponse.json({
      received: true,
      outcome: "ignored_no_match",
      reason: "missing_square_order_id",
    });
  }

  try {
    const result = await syncSquareOrderStatusBySquareOrderId({
      squareOrderId: meta.squareOrderId,
      applySource: "webhook",
      webhookPayload: payload,
      webhookEventId: meta.externalEventId,
      merchantId: meta.merchantId,
      locationId: meta.locationId,
    });

    if (!result.matched) {
      await markProviderWebhookEventProcessed(logged.id, "ignored", {
        code: "ignored_no_match",
        message: `No VendorOrder for squareOrderId ${meta.squareOrderId}`,
      });
      return NextResponse.json({
        received: true,
        outcome: "ignored_no_match",
        squareOrderId: meta.squareOrderId,
      });
    }

    await prismaProviderWebhookLink(logged.id, result.vendorOrderId, result.orderId);

    const processedStatus = result.outcome === "fetch_failed" ? "failed" : "processed";
    await markProviderWebhookEventProcessed(logged.id, processedStatus, {
      code: result.outcome,
      message: result.detail,
    });

    return NextResponse.json({
      received: true,
      outcome: result.outcome,
      updated: result.updatedVendorOrderState,
      vendorOrderId: result.vendorOrderId,
      orderId: result.orderId,
      squareOrderId: meta.squareOrderId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markProviderWebhookEventProcessed(logged.id, "failed", {
      code: "failed_processing",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function prismaProviderWebhookLink(
  eventId: string,
  vendorOrderId: string,
  orderId: string
): Promise<void> {
  const { prisma } = await import("@/lib/db");
  await prisma.providerWebhookEvent.update({
    where: { id: eventId },
    data: {
      relatedVendorOrderId: vendorOrderId,
      relatedOrderId: orderId,
    },
  });
}
