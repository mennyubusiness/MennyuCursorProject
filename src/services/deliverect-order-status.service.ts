import "server-only";

import type { DeliverectWebhookApplyResult } from "@/domain/deliverect-webhook-apply";
import { interpretDeliverectWebhookFlat } from "@/integrations/deliverect/deliverect-status-map";
import { DELIVERECT_STATUS_NAME_TO_CODE } from "@/integrations/deliverect/payload-status-read";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { flattenDeliverectWebhookPayload } from "@/integrations/deliverect/webhook-handler";
import { applyDeliverectStatusFromAdminSimulator } from "@/services/order-status.service";

const STATUS_CODE_TO_NAME: Partial<Record<number, string>> = {
  20: "ACCEPTED",
  40: "PRINTED",
  50: "PREPARING",
  60: "PREPARED",
  70: "PICKUP_READY",
  90: "FINALIZED",
  95: "AUTO_FINALIZED",
  100: "DISPATCH",
  110: "CANCELED",
  120: "FAILED",
};

/** Build a Deliverect-shaped webhook payload for admin QA (no outbound Deliverect call). */
export function buildAdminSimulatedDeliverectWebhookPayload(
  statusCode: number,
  opts?: { note?: string; receivedAt?: Date }
): DeliverectWebhookPayload & Record<string, unknown> {
  const receivedAt = opts?.receivedAt ?? new Date();
  const eventType =
    STATUS_CODE_TO_NAME[statusCode] ??
    Object.entries(DELIVERECT_STATUS_NAME_TO_CODE).find(([, c]) => c === statusCode)?.[0] ??
    `CODE_${statusCode}`;

  return {
    status: String(statusCode),
    orderStatus: statusCode,
    statusCode,
    eventType,
    _openOrderAdminSimulator: {
      source: "admin_simulator",
      statusCode,
      note: opts?.note ?? null,
      simulatedAt: receivedAt.toISOString(),
    },
  };
}

export type ApplyDeliverectOrderStatusUpdateParams = {
  vendorOrderId: string;
  statusCode: number;
  statusName?: string;
  rawPayload?: unknown;
  receivedAt?: Date;
  source: "webhook" | "admin_simulator";
  note?: string;
};

export type ApplyDeliverectOrderStatusUpdateResult = DeliverectWebhookApplyResult & {
  mappedFulfillmentStatus: string | null;
  mappedRoutingStatus: string | null;
};

/**
 * Apply Deliverect order status using the same inbound pipeline as real webhooks.
 * Only `admin_simulator` is supported here; production webhooks call `applyDeliverectStatusWebhook`.
 */
export async function applyDeliverectOrderStatusUpdate(
  params: ApplyDeliverectOrderStatusUpdateParams
): Promise<ApplyDeliverectOrderStatusUpdateResult> {
  if (params.source !== "admin_simulator") {
    throw new Error("applyDeliverectOrderStatusUpdate only supports source admin_simulator");
  }

  const rawPayload =
    params.rawPayload ??
    buildAdminSimulatedDeliverectWebhookPayload(params.statusCode, {
      note: params.note,
      receivedAt: params.receivedAt,
    });

  const flat = flattenDeliverectWebhookPayload(
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as DeliverectWebhookPayload)
      : ({} as DeliverectWebhookPayload)
  );
  const interpretation = interpretDeliverectWebhookFlat(flat);

  const result = await applyDeliverectStatusFromAdminSimulator(
    params.vendorOrderId,
    null,
    rawPayload
  );

  return {
    ...result,
    mappedFulfillmentStatus:
      interpretation.kind === "mapped" ? interpretation.fulfillmentStatus : null,
    mappedRoutingStatus:
      interpretation.kind === "mapped" ? (interpretation.routingStatus ?? null) : null,
  };
}
