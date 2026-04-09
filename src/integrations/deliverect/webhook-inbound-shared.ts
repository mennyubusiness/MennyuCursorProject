/**
 * Shared Deliverect inbound webhook helpers: HMAC secret resolution, signature headers, JSON parse.
 * Used by order-status webhook and menu-update webhook (same HMAC rules per Deliverect docs).
 */
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Webhook HMAC mode (not the same as NODE_ENV on Vercel).
 * - Set `DELIVERECT_ENV=staging` when testing Deliverect sandbox while NODE_ENV=production.
 * - Only `DELIVERECT_ENV=production` forces partner-secret verification.
 */
export function isDeliverectWebhookProduction(): boolean {
  const d = env.DELIVERECT_ENV?.trim();
  if (d !== undefined && d !== "") {
    return d.toLowerCase() === "production";
  }
  return env.NODE_ENV === "production";
}

export function getDeliverectSignatureFromRequest(request: NextRequest): string | null {
  return (
    request.headers.get("x-server-authorization-hmac-sha256") ??
    request.headers.get("X-Server-Authorization-Hmac-Sha256") ??
    request.headers.get("x-deliverect-hmacsha256") ??
    request.headers.get("X-Deliverect-Hmac-Sha256") ??
    request.headers.get("x-deliverect-signature") ??
    request.headers.get("x-signature") ??
    null
  );
}

export function nonEmptyStringField(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s !== "" ? s : null;
}

/**
 * Staging HMAC secret: channel link id from a record or nested `channelLink` object.
 */
export function channelLinkIdFromRecord(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;

  for (const key of ["channelLinkId", "id", "_id"] as const) {
    const s = nonEmptyStringField(obj[key]);
    if (s) return s;
  }

  const cl = obj.channelLink;
  if (typeof cl === "string") {
    const s = cl.trim();
    if (s) return s;
  }
  if (cl && typeof cl === "object" && !Array.isArray(cl)) {
    const nested = cl as Record<string, unknown>;
    for (const key of ["id", "_id", "channelLinkId"] as const) {
      const s = nonEmptyStringField(nested[key]);
      if (s) return s;
    }
  }

  return null;
}

/** Staging/sandbox: HMAC secret is often the channel link id from the webhook JSON. */
export function extractChannelLinkIdSecret(parsed: Record<string, unknown>): string | null {
  const candidates: Array<Record<string, unknown> | undefined> = [
    parsed,
    parsed.data as Record<string, unknown> | undefined,
    parsed.order as Record<string, unknown> | undefined,
    parsed.payload as Record<string, unknown> | undefined,
  ];
  for (const obj of candidates) {
    const found = channelLinkIdFromRecord(obj);
    if (found) return found;
  }

  const loc = parsed.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const fromLoc = channelLinkIdFromRecord(loc as Record<string, unknown>);
    if (fromLoc) return fromLoc;
  }

  return null;
}

export function parseDeliverectWebhookJsonObject(
  rawBody: string
): { ok: true; parsed: Record<string, unknown> } | { ok: false; error: "invalid_json" } {
  try {
    const v = JSON.parse(rawBody) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "invalid_json" };
    }
    return { ok: true, parsed: v as Record<string, unknown> };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

/**
 * Production: `DELIVERECT_WEBHOOK_SECRET`.
 * Staging/sandbox: prefer channel link id from JSON (HMAC key per Deliverect sandbox docs); if absent
 * (e.g. prep-time / busy-mode bodies), fall back to `DELIVERECT_WEBHOOK_SECRET` when set.
 */
export function resolveDeliverectWebhookVerificationSecret(
  parsed: Record<string, unknown>,
  production: boolean
): { secret: string | undefined; hasChannelLinkId: boolean } {
  if (production) {
    return {
      secret: env.DELIVERECT_WEBHOOK_SECRET?.trim() || undefined,
      hasChannelLinkId: false,
    };
  }
  const ch = extractChannelLinkIdSecret(parsed);
  if (ch) {
    return { secret: ch, hasChannelLinkId: true };
  }
  const partner = env.DELIVERECT_WEBHOOK_SECRET?.trim();
  return { secret: partner || undefined, hasChannelLinkId: false };
}
