/**
 * Read normalized Deliverect status codes from flattened webhook payloads.
 * Shared by audit strings and strict status mapping (no app logic here).
 */

export const DELIVERECT_STATUS_NAME_TO_CODE: Record<string, number> = {
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

export function coerceDeliverectRawToStatusNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    const key = t.toUpperCase().replace(/[\s-]+/g, "_");
    if (DELIVERECT_STATUS_NAME_TO_CODE[key] != null) {
      return DELIVERECT_STATUS_NAME_TO_CODE[key];
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return coerceDeliverectRawToStatusNumber(
      o.code ?? o.status ?? o.value ?? o.id ?? o.orderStatus
    );
  }
  return null;
}

const STATUS_FIELD_KEYS = [
  "status",
  "orderStatus",
  "posStatus",
  "posOrderStatus",
  "channelStatus",
  "statusCode",
  "newStatus",
  "orderStatusCode",
  "deliveryStatus",
] as const;

/** Read first resolvable numeric Deliverect status code from a flattened payload. */
export function readDeliverectStatusCodeFromFlat(
  flat: Record<string, unknown>
): number | null {
  for (const k of STATUS_FIELD_KEYS) {
    const n = coerceDeliverectRawToStatusNumber(flat[k]);
    if (n != null) return n;
  }
  return null;
}
