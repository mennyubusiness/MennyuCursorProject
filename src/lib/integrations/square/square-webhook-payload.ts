export type SquareWebhookEnvelope = {
  merchant_id?: string;
  type?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: Record<string, unknown>;
  };
};

export function parseSquareWebhookJson(rawBody: string): SquareWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(rawBody) as SquareWebhookEnvelope;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function extractSquareWebhookEventMeta(payload: SquareWebhookEnvelope): {
  eventType: string;
  externalEventId: string | null;
  merchantId: string | null;
  squareOrderId: string | null;
  locationId: string | null;
} {
  const eventType = payload.type?.trim() ?? "unknown";
  const externalEventId = payload.event_id?.trim() ?? null;
  const merchantId = payload.merchant_id?.trim() ?? null;

  const object = payload.data?.object ?? {};
  const orderUpdated = object.order_updated as Record<string, unknown> | undefined;
  const orderCreated = object.order_created as Record<string, unknown> | undefined;
  const order = (orderUpdated?.order ?? orderCreated?.order) as Record<string, unknown> | undefined;

  const squareOrderId =
    (typeof orderUpdated?.order_id === "string" ? orderUpdated.order_id : null) ??
    (typeof order?.id === "string" ? order.id : null) ??
    (typeof payload.data?.id === "string" && payload.data?.type === "order" ? payload.data.id : null);

  const locationId =
    typeof order?.location_id === "string" ? order.location_id.trim() : null;

  return {
    eventType,
    externalEventId,
    merchantId,
    squareOrderId: squareOrderId?.trim() ?? null,
    locationId,
  };
}
