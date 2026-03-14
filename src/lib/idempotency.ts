/**
 * Idempotency key helpers for payment, order creation, Deliverect, webhooks.
 * Keys should be unique per operation (e.g. client-generated UUID for checkout).
 */
import { createHash } from "crypto";

export function buildIdempotencyKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

export function webhookIdempotencyKey(provider: string, eventId: string | null, body: string): string {
  const raw = eventId ? `${provider}:${eventId}` : `${provider}:${hashBody(body)}`;
  return `webhook:${raw}`;
}

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}
