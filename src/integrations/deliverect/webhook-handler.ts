/**
 * Deliverect order-status webhook: verify HMAC, resolve vendor order, map POS/channel status codes.
 * Field names and nesting are aligned with Deliverect docs + common variants (data/order wrappers).
 * @see https://developers.deliverect.com/docs/how-to-i-verify-orders-received-to-webhook
 * @see https://developers.deliverect.com/page/order-status
 */
import { createHash, createHmac } from "crypto";
import type { DeliverectWebhookPayload } from "./payloads";
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "@/domain/types";

export function parseDeliverectWebhookBody(body: string): DeliverectWebhookPayload {
  try {
    return JSON.parse(body) as DeliverectWebhookPayload;
  } catch {
    return {};
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length !== y.length || x.length % 2 !== 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * HMAC-SHA256 of raw body vs shared secret.
 * Production: DELIVERECT_WEBHOOK_SECRET required (Deliverect partner secret).
 * Staging: often sign with channel link ID — set env to that ID (comma-separate multiple links).
 * Dev: if no secret, accepts webhooks (logs warning); set DELIVERECT_WEBHOOK_SECRET for real verification.
 */
export function verifyDeliverectSignature(
  body: string,
  signature: string | null,
  secretEnv: string | undefined,
  opts?: { nodeEnv?: string; allowUnsignedDev?: boolean }
): boolean {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const secrets = (secretEnv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sigHeader = signature?.trim() ?? "";
  const sigNorm = sigHeader.replace(/^sha256\s*=/i, "").trim();

  if (secrets.length === 0) {
    if (nodeEnv === "production") {
      console.error("[Deliverect webhook] DELIVERECT_WEBHOOK_SECRET is required in production");
      return false;
    }
    if (!sigNorm && opts?.allowUnsignedDev !== false) {
      console.warn("[Deliverect webhook] No secret configured; accepting unsigned webhook (development only)");
      return true;
    }
    if (sigNorm) {
      console.warn(
        "[Deliverect webhook] Signature present but DELIVERECT_WEBHOOK_SECRET unset; cannot verify (development accept)"
      );
      return true;
    }
    return true;
  }

  if (!sigNorm) return false;

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    if (timingSafeEqualHex(sigNorm, expected)) return true;
  }
  return false;
}

const CUID_LIKE = /^c[a-z0-9]{24}$/i;

/**
 * Merge nested objects Deliverect may use (order, data, orderUpdate) so channelOrderId/status surface at top level.
 * Later merges override earlier for the same key (data often wins over order wrapper).
 */
export function flattenDeliverectWebhookPayload(
  payload: DeliverectWebhookPayload
): Record<string, unknown> {
  const base = { ...(payload as Record<string, unknown>) };
  const nestedSources = [base.order, base.data, base.orderUpdate, base.body, base.webhook].filter(
    (x): x is Record<string, unknown> =>
      x != null && typeof x === "object" && !Array.isArray(x)
  );
  const flat = { ...base };
  for (const src of nestedSources) {
    for (const [k, v] of Object.entries(src)) {
      if (v === undefined) continue;
      flat[k] = v;
    }
  }

  const ch = flat.channelOrder;
  if (ch && typeof ch === "object" && !Array.isArray(ch)) {
    const co = ch as Record<string, unknown>;
    if (flat.channelOrderId == null && co.channelOrderId != null) {
      flat.channelOrderId = co.channelOrderId;
    }
    if (flat.channelOrderId == null && co.id != null) {
      const id = String(co.id).trim();
      if (CUID_LIKE.test(id)) flat.channelOrderId = id;
    }
  }

  return flat;
}

const STATUS_NAME_TO_CODE: Record<string, number> = {
  NEW: 10,
  ACCEPTED: 20,
  PRINTED: 40,
  PREPARING: 50,
  PREPARED: 60,
  PICKUP_READY: 70,
  READY: 70,
  READY_FOR_PICKUP: 70,
  FINALIZED: 90,
  AUTO_FINALIZED: 95,
  CANCELED: 110,
  CANCELLED: 110,
  FAILED: 120,
  POS_FAILED: 121,
  PARSED: 1,
  RECEIVED_BY_POS: 2,
};

function coerceToStatusNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    const key = t.toUpperCase().replace(/[\s-]+/g, "_");
    if (STATUS_NAME_TO_CODE[key] != null) return STATUS_NAME_TO_CODE[key];
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return coerceToStatusNumber(o.code ?? o.status ?? o.value ?? o.id ?? o.orderStatus);
  }
  return null;
}

function readStatusCode(flat: Record<string, unknown>): number | null {
  const keys = [
    "status",
    "orderStatus",
    "posStatus",
    "posOrderStatus",
    "channelStatus",
    "statusCode",
    "newStatus",
    "orderStatusCode",
    "deliveryStatus",
  ];
  for (const k of keys) {
    const n = coerceToStatusNumber(flat[k]);
    if (n != null) return n;
  }
  return null;
}

/**
 * Map Deliverect POS / channel status integers to Mennyu vendor-order state.
 * @see https://developers.deliverect.com/page/order-status
 */
export function mapDeliverectStatusCodeToUpdate(statusCode: number | null): {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
} {
  if (statusCode == null) return {};

  if ([110, 100, 115].includes(statusCode)) {
    return { routingStatus: "confirmed", fulfillmentStatus: "cancelled" };
  }
  if ([120, 121, 124, 125, 35, 126].includes(statusCode)) {
    return { routingStatus: "failed", fulfillmentStatus: "pending" };
  }

  if ([0, 1, 2, 3, 4, 5, 6, 7, 10, 20, 25].includes(statusCode)) {
    return { routingStatus: "confirmed", fulfillmentStatus: "accepted" };
  }
  if (statusCode === 40) {
    return { routingStatus: "confirmed", fulfillmentStatus: "preparing" };
  }
  if (statusCode === 50) {
    return { routingStatus: "confirmed", fulfillmentStatus: "preparing" };
  }
  if (statusCode === 60 || statusCode === 70) {
    return { routingStatus: "confirmed", fulfillmentStatus: "ready" };
  }
  if (statusCode === 90 || statusCode === 95) {
    return { routingStatus: "confirmed", fulfillmentStatus: "completed" };
  }
  if (statusCode === 89) {
    return { routingStatus: "confirmed", fulfillmentStatus: "completed" };
  }

  return {};
}

function mapDeliverectStringEvent(eventType: string): {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
} {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("confirm") || normalized.includes("accepted")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "accepted" };
  }
  if (normalized.includes("preparing") || normalized.includes("in_preparation")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "preparing" };
  }
  if (normalized.includes("ready") || normalized.includes("ready_for_pickup")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "ready" };
  }
  if (normalized.includes("completed") || normalized.includes("done")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "completed" };
  }
  if (normalized.includes("cancel")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "cancelled" };
  }
  if (normalized.includes("reject") || normalized.includes("failed")) {
    return { routingStatus: "failed", fulfillmentStatus: "pending" };
  }
  return {};
}

export interface DeliverectStatusUpdate {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
}

export function mapDeliverectWebhookToStatusUpdate(
  flat: Record<string, unknown>
): DeliverectStatusUpdate {
  const code = readStatusCode(flat);
  const fromCode = mapDeliverectStatusCodeToUpdate(code);
  if (fromCode.routingStatus || fromCode.fulfillmentStatus) return fromCode;

  const eventType = String(
    flat.eventType ?? flat.type ?? flat.event ?? flat.reason ?? ""
  );
  if (eventType) return mapDeliverectStringEvent(eventType);

  return {};
}

/** Extract Deliverect external order id (Mongo-style); exclude Mennyu cuid. */
export function extractDeliverectExternalOrderId(flat: Record<string, unknown>): string | null {
  const candidates = [
    flat._id,
    flat.oid,
    flat.deliverectOrderId,
    flat.deliveryId,
    flat.deliverectId,
    flat.internalOrderId,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (!s || CUID_LIKE.test(s)) continue;
    if (s.length >= 8) return s;
  }
  const orderId = flat.orderId ?? flat.orderID;
  if (orderId != null) {
    const s = String(orderId).trim();
    if (s && !CUID_LIKE.test(s) && s.length >= 8) return s;
  }
  return null;
}

/**
 * Resolve Mennyu vendor order id (matches create-order channelOrderId).
 * checkoutId is only used when it looks like a Mennyu cuid (avoids treating Deliverect UUIDs as VO id).
 */
export function resolveMennyuVendorOrderId(flat: Record<string, unknown>): string | null {
  const candidates = [
    flat.mennyuVendorOrderId,
    flat.channelOrderId,
    flat.channelOrderDisplayId,
    flat.checkoutId,
  ];
  for (const mennyu of candidates) {
    if (mennyu == null) continue;
    const s = String(mennyu).trim();
    if (CUID_LIKE.test(s)) return s;
  }
  const orderId = flat.orderId ?? flat.orderID;
  if (orderId != null) {
    const s = String(orderId).trim();
    if (CUID_LIKE.test(s)) return s;
  }
  return null;
}

function bodyFingerprint(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 20);
}

/**
 * Stable id per webhook delivery. Do not use Deliverect order `_id` alone — it repeats across status updates.
 * Prefer message-level ids; else composite order + status + timestamp; else body fingerprint when time missing.
 */
export function getDeliverectEventId(
  payload: DeliverectWebhookPayload,
  flat: Record<string, unknown>,
  rawBody: string
): string | null {
  const messageKeys = [
    "webhookId",
    "webhook_id",
    "eventId",
    "event_id",
    "uuid",
    "eventUUID",
    "messageId",
    "message_id",
    "correlationId",
  ] as const;
  for (const k of messageKeys) {
    const v = flat[k] ?? (payload as Record<string, unknown>)[k];
    if (v != null && String(v).trim()) return `deliverect:msg:${String(v).trim()}`;
  }

  const ext = extractDeliverectExternalOrderId(flat);
  const ch = resolveMennyuVendorOrderId(flat);
  const st = readStatusCode(flat);
  const u =
    flat.updatedAt ??
    flat.updated_at ??
    flat.timestamp ??
    flat.timeStamp ??
    flat.updatedAtMs;

  const tail =
    u != null && String(u).trim() !== ""
      ? String(u)
      : st != null
        ? bodyFingerprint(rawBody)
        : "";

  if (ext != null && st != null && tail !== "") {
    return `deliverect:ext:${ext}:${st}:${tail}`;
  }
  if (ch != null && st != null && tail !== "") {
    return `deliverect:ch:${ch}:${st}:${tail}`;
  }

  return null;
}

export function resolveWebhookStatusUpdate(payload: DeliverectWebhookPayload): {
  internalVendorOrderId: string | null;
  externalOrderId: string | null;
  update: DeliverectStatusUpdate;
} {
  const flat = flattenDeliverectWebhookPayload(payload);
  const internalVendorOrderId = resolveMennyuVendorOrderId(flat);
  const externalOrderId = extractDeliverectExternalOrderId(flat);
  const update = mapDeliverectWebhookToStatusUpdate(flat);
  return {
    internalVendorOrderId,
    externalOrderId,
    update,
  };
}
