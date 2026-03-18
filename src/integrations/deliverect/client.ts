/**
 * HTTP client for Deliverect API (sandbox-ready).
 * Uses OAuth Bearer token from client credentials flow. Caller persists payload and raw response for audit.
 * Order creation URL per Deliverect docs: {base}/{channelName}/order/{channelLinkId} (channel name case-sensitive).
 */
import { env } from "@/lib/env";
import { getDeliverectAuthHeaders } from "@/integrations/deliverect/auth";
import type { DeliverectOrderRequest, DeliverectOrderResponse } from "./payloads";

const BASE_URL = env.DELIVERECT_API_URL ?? "https://api.deliverect.com";
const LOG_PREFIX = "[Deliverect client]";

/**
 * Deliverect often returns Mongo-style `_id` instead of `id`. Handles nested `order` / `data` and `$oid` wrappers.
 */
export function extractDeliverectOrderId(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const tryStr = (v: unknown): string | undefined => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && "$oid" in (v as object)) {
      const oid = (v as { $oid?: string }).$oid;
      return typeof oid === "string" && oid.trim() ? oid.trim() : undefined;
    }
    return undefined;
  };
  const o = raw as Record<string, unknown>;
  const direct = tryStr(o.id) ?? tryStr(o._id) ?? tryStr(o.orderId);
  if (direct) return direct;
  if (o.order && typeof o.order === "object") {
    const ord = o.order as Record<string, unknown>;
    const nested = tryStr(ord._id) ?? tryStr(ord.id);
    if (nested) return nested;
  }
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    const nested = tryStr(d._id) ?? tryStr(d.id);
    if (nested) return nested;
  }
  return undefined;
}

/** True when JSON body is an explicit error/validation response (not an empty 201 success). */
function deliverectBodyIndicatesError(raw: unknown): boolean {
  if (raw == null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === "string" && o.error.trim().length > 0) return true;
  if (o.success === false) return true;
  const code = o.code;
  if (typeof code === "string" && /error|fail|invalid/i.test(code)) return true;
  return false;
}

function safeJsonForLog(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Safe header snapshot for logs + DB (no cookies/auth echoes). */
export function collectDeliverectResponseHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set(["set-cookie", "cookie"]);
  res.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (skip.has(lk) || lk.includes("authorization")) return;
    const trimmed = value.length > 800 ? `${value.slice(0, 800)}…` : value;
    out[key] = trimmed;
  });
  return out;
}

export type DeliverectResponseAudit = {
  httpStatus: number;
  responseHeaders: Record<string, string>;
  body: unknown;
};

export async function submitOrder(
  payload: DeliverectOrderRequest
): Promise<{
  success: boolean;
  externalOrderId?: string;
  error?: string;
  raw?: unknown;
  responseAudit?: DeliverectResponseAudit;
  /** Set when HTTP 2xx but body has no order id (e.g. 201 + {}). */
  acceptedWithoutExternalId?: boolean;
}> {
  const channelName = env.DELIVERECT_CHANNEL_NAME?.trim();
  const channelLinkId = payload.channelLinkId;
  const url =
    channelName && channelLinkId
      ? `${BASE_URL.replace(/\/$/, "")}/${channelName}/order/${channelLinkId}`
      : `${BASE_URL.replace(/\/$/, "")}/orders`;

  if (!channelName && channelLinkId) {
    console.warn(
      `${LOG_PREFIX} DELIVERECT_CHANNEL_NAME not set; using legacy /orders path (may return Method Not Allowed)`
    );
  }

  const method = "POST";
  console.info(`${LOG_PREFIX} Outbound request method=${method} url=${url}`);

  const body = JSON.stringify(payload);
  const authHeaders = await getDeliverectAuthHeaders();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders,
  };

  /** Diagnostics for “order not in Deliverect UI” (duplicates, date filter, etc.). No secrets. */
  function submitDiagnostics(httpStatus: number, raw: unknown) {
    const p = payload as Record<string, unknown>;
    const pickupTime = p.pickupTime;
    console.info(
      `${LOG_PREFIX} submitDiagnostics ${JSON.stringify({
        httpStatus,
        channelOrderId: payload.channelOrderId,
        channelOrderDisplayId: payload.channelOrderDisplayId,
        sameChannelOrderAndDisplay: payload.channelOrderId === payload.channelOrderDisplayId,
        pickupTimePresent: pickupTime != null,
        pickupTime: pickupTime ?? null,
        preparationTime: payload.preparationTime ?? null,
        deliverectResponseId: extractDeliverectOrderId(raw) ?? null,
        duplicateNote:
          "Deliverect may hide re-submits with the same channelOrderId; widen Orders tab date range if using pickupTime.",
      })}`
    );
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
    });
    const raw = (await res.json().catch(() => ({}))) as DeliverectOrderResponse & { id?: string };
    const responseHeaders = collectDeliverectResponseHeaders(res);
    const responseAudit: DeliverectResponseAudit = {
      httpStatus: res.status,
      responseHeaders,
      body: raw,
    };

    const headerDiag = {
      location: res.headers.get("location"),
      xRequestId: res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id"),
    };

    if (!res.ok) {
      console.warn(`${LOG_PREFIX} Non-2xx response status=${res.status}`);
      submitDiagnostics(res.status, raw);
      console.warn(`${LOG_PREFIX} Response headers (sanitized keys):`, safeJsonForLog(responseHeaders));
      console.warn(`${LOG_PREFIX} Response body:`, JSON.stringify(raw, null, 2));
      console.warn(`${LOG_PREFIX} Outbound payload (for debugging):`, JSON.stringify(payload, null, 2));
      return {
        success: false,
        error: raw.error ?? (raw as { message?: string }).message ?? res.statusText,
        raw,
        responseAudit,
      };
    }

    submitDiagnostics(res.status, raw);
    console.info(`${LOG_PREFIX} Success HTTP ${res.status} parsed body:`, safeJsonForLog(raw));
    console.info(
      `${LOG_PREFIX} Success response headers (diagnostic): ${safeJsonForLog(headerDiag)} fullHeaderKeys=${Object.keys(responseHeaders).join(",")}`
    );

    const externalOrderId = extractDeliverectOrderId(raw);
    if (externalOrderId) {
      return {
        success: true,
        externalOrderId,
        raw,
        responseAudit,
      };
    }

    if (deliverectBodyIndicatesError(raw)) {
      const err = `Deliverect ${res.status}: error/validation in body: ${safeJsonForLog(raw)}`;
      console.warn(`${LOG_PREFIX} ${err}`);
      console.warn(`${LOG_PREFIX} Full response headers:`, safeJsonForLog(responseHeaders));
      return { success: false, error: err, raw, responseAudit };
    }

    const bodyKeys =
      raw && typeof raw === "object" ? Object.keys(raw as object).join(",") || "(empty)" : "(non-object)";
    console.warn(`${LOG_PREFIX} Full response headers (no id in body):`, safeJsonForLog(responseHeaders));
    console.info(
      `${LOG_PREFIX} HTTP ${res.status} body keys=${bodyKeys}: accepted as routed to Deliverect without synchronous order id (e.g. 201 {}). Reconcile deliverectOrderId via webhook when available.`
    );

    return {
      success: true,
      raw,
      responseAudit,
      acceptedWithoutExternalId: true,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}
