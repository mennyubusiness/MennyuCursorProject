/**
 * Persist minimal audit rows for rejected Deliverect order webhooks (bad signature, bad JSON, missing secret)
 * so ops can correlate failures without relying only on logs. Idempotent per raw body hash.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

export type DeliverectOrderWebhookRejectReason =
  | "bad_signature"
  | "missing_verification_secret"
  | "invalid_json";

export function deliverectWebhookRejectIdempotencyKey(rawBody: string): string {
  const h = createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, 32);
  return `webhook:deliverect:reject:${h}`;
}

export async function persistDeliverectOrderWebhookRejection(
  rawBody: string,
  reason: DeliverectOrderWebhookRejectReason
): Promise<void> {
  const idempotencyKey = deliverectWebhookRejectIdempotencyKey(rawBody);
  const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
  if (existing) return;

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect",
      idempotencyKey,
      payload: {
        kind: "order_webhook_rejection",
        reason,
        bodyLength: rawBody.length,
      },
      processed: true,
      processedAt: new Date(),
      errorMessage: `verification_failed:${reason}`,
    },
  });
}
