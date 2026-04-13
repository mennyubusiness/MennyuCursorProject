/**
 * Deliverect preparation time update → Mennyu `Order.deliverectEstimatedReadyAt` (POS ETA; not customer schedule).
 * @see https://developers.deliverect.com/reference/post-preparation-time-update
 */
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import { verifyDeliverectInboundWebhookJson } from "@/integrations/deliverect/deliverect-inbound-webhook-verify";
import { unwrapDeliverectSingleObjectPayload } from "@/integrations/deliverect/deliverect-webhook-unwrap";
import { isDeliverectWebhookProduction } from "@/integrations/deliverect/webhook-inbound-shared";
import { logDeliverectPrepTimeWebhook } from "@/integrations/deliverect/deliverect-aux-webhook-log";
import {
  applyDeliverectPrepTimeFromPayload,
  enrichPrepTimePayloadForWebhookVerification,
} from "@/services/deliverect-prep-time-webhook.service";
import { persistDeliverectOrderWebhookRejection } from "../verification-audit";

export const dynamic = "force-dynamic";

function bodyShaPrefix(rawBody: string, n = 12): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, n);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    await persistDeliverectOrderWebhookRejection(rawBody, "invalid_json");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const unwrap = unwrapDeliverectSingleObjectPayload(parsedJson);
  if (!unwrap.ok) {
    return NextResponse.json(unwrap.body, { status: unwrap.status });
  }

  let parsedForVerify = unwrap.object;
  if (!isDeliverectWebhookProduction()) {
    parsedForVerify = await enrichPrepTimePayloadForWebhookVerification(unwrap.object);
  }

  const v = await verifyDeliverectInboundWebhookJson(request, rawBody, parsedForVerify);
  if (!v.ok) return v.response;

  const idemKey = webhookIdempotencyKey("deliverect_prep_time", null, rawBody);
  const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: idemKey } });
  if (existing) {
    logDeliverectPrepTimeWebhook("duplicate_ignored", {
      idempotencyKey: idemKey,
      processed: existing.processed,
    });
    return NextResponse.json({ received: true, duplicate: true, processed: existing.processed });
  }

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect_prep_time",
      idempotencyKey: idemKey,
      payload: unwrap.object as object,
    },
  });

  try {
    const applied = await applyDeliverectPrepTimeFromPayload(unwrap.object, rawBody);
    if (!applied.ok) {
      const errMsg =
        applied.error === "order_not_found"
          ? "order_not_found"
          : `invalid_pickup_time:${applied.detail ?? ""}`;
      await prisma.webhookEvent.updateMany({
        where: { idempotencyKey: idemKey },
        data: {
          processed: true,
          processedAt: new Date(),
          errorMessage: errMsg,
        },
      });
      return NextResponse.json({
        received: true,
        outcome: applied.error,
      });
    }

    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: { processed: true, processedAt: new Date(), errorMessage: null },
    });

    return NextResponse.json({
      received: true,
      outcome: applied.outcome,
      vendorOrderId: applied.vendorOrderId,
      orderId: applied.orderId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logDeliverectPrepTimeWebhook("apply_error", { message, bodySha256Prefix: bodyShaPrefix(rawBody) });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: { processed: false, errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
