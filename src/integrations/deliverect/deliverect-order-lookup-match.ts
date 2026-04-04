/**
 * Validates GET order response is the same logical order as our VendorOrder (no fuzzy matching).
 * Mennyu sends channelOrderId === channelOrderDisplayId === vendorOrder.id on submit.
 */
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import {
  extractDeliverectExternalOrderId,
  flattenDeliverectWebhookPayload,
} from "@/integrations/deliverect/webhook-handler";
import { extractDeliverectOrderId } from "@/integrations/deliverect/client";

export type DeliverectOrderMatchResult =
  | { match: true }
  | { match: false; reason: "channel_order_mismatch" | "external_id_mismatch" | "empty_body" };

/**
 * After GET by `lookupDeliverectOrderId`, ensure payload belongs to this vendor order.
 * - If channel ids are present, they must equal `vendorOrderId`.
 * - If we had a stored Deliverect id, response root id should match lookup id when extractable.
 */
export function matchDeliverectGetOrderResponseToVendorOrder(
  raw: unknown,
  vendorOrderId: string,
  lookupDeliverectOrderId: string,
  storedDeliverectOrderId: string | null
): DeliverectOrderMatchResult {
  if (raw == null || (typeof raw === "object" && raw !== null && Object.keys(raw as object).length === 0)) {
    return { match: false, reason: "empty_body" };
  }
  const payload = (typeof raw === "object" && raw !== null ? raw : {}) as DeliverectWebhookPayload;
  const flat = flattenDeliverectWebhookPayload(payload);
  const ch = String(flat.channelOrderId ?? flat.channelOrderDisplayId ?? "").trim();
  if (ch) {
    if (ch !== vendorOrderId) {
      return { match: false, reason: "channel_order_mismatch" };
    }
  }
  const ext =
    extractDeliverectExternalOrderId(flat) ?? extractDeliverectOrderId(raw) ?? extractDeliverectOrderId(flat);
  if (storedDeliverectOrderId && ext && ext !== storedDeliverectOrderId) {
    return { match: false, reason: "external_id_mismatch" };
  }
  if (ext && ext !== lookupDeliverectOrderId) {
    return { match: false, reason: "external_id_mismatch" };
  }
  return { match: true };
}
