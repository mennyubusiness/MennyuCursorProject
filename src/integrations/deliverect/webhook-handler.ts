/**
 * Deliverect webhook: parse, verify (stub), dispatch to status updates.
 * Idempotency and raw payload logging are handled in the API route.
 */
import type { DeliverectWebhookPayload } from "./payloads";
import { mapDeliverectEventToStatus } from "@/domain/order-state";
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "@/domain/types";

export function parseDeliverectWebhookBody(body: string): DeliverectWebhookPayload {
  try {
    return JSON.parse(body) as DeliverectWebhookPayload;
  } catch {
    return {};
  }
}

/**
 * Stub: verify webhook signature when Deliverect provides a signing secret.
 * Return true to accept, false to reject.
 */
export function verifyDeliverectSignature(
  _payload: string,
  _signature: string | null,
  _secret: string | undefined
): boolean {
  if (!_secret) return true; // MVP: no secret configured → accept
  // TODO: implement HMAC or other verification per Deliverect docs
  return true;
}

export function getDeliverectEventId(payload: DeliverectWebhookPayload): string | null {
  const raw = payload.eventId ?? payload.id ?? payload.orderId;
  return raw != null ? String(raw) : null;
}

export interface DeliverectStatusUpdate {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
}

/** CUID-like pattern; our internal IDs use this. */
const CUID_LIKE = /^c[a-z0-9]{24}$/i;

/**
 * Resolve which vendor order this webhook refers to.
 * 1) Prefer internal reference (mennyuVendorOrderId).
 * 2) If orderId looks like our cuid, use as internal id.
 * 3) Otherwise return external id for lookup by deliverectOrderId.
 */
export function resolveWebhookStatusUpdate(
  payload: DeliverectWebhookPayload
): {
  internalVendorOrderId: string | null;
  externalOrderId: string | null;
  update: DeliverectStatusUpdate;
} {
  const eventType = (payload.eventType ?? payload.status ?? payload.type ?? "") as string;
  const update = mapDeliverectEventToStatus(eventType, payload);
  const mennyuId = payload.mennyuVendorOrderId != null ? String(payload.mennyuVendorOrderId) : null;
  const orderIdRaw = payload.orderId != null ? String(payload.orderId) : null;
  const externalId = payload.deliverectOrderId != null ? String(payload.deliverectOrderId) : null;
  const internalVendorOrderId =
    mennyuId ?? (orderIdRaw && CUID_LIKE.test(orderIdRaw) ? orderIdRaw : null);
  return {
    internalVendorOrderId,
    externalOrderId: externalId ?? (!internalVendorOrderId ? orderIdRaw : null),
    update: {
      routingStatus: update.routingStatus,
      fulfillmentStatus: update.fulfillmentStatus,
    },
  };
}
