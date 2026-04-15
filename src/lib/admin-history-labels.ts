/**
 * Human-readable labels for vendor order status history (event log / timeline).
 * Uses existing VendorOrderStatusHistory; no schema changes.
 */

export interface HistoryEntryForLabel {
  routingStatus?: string | null;
  fulfillmentStatus?: string | null;
  source?: string | null;
  rawPayload?: unknown;
}

/**
 * Returns a short, human-readable event label for a status history entry.
 * Used in the admin vendor-order event log / timeline.
 */
export function getVendorOrderHistoryEventLabel(entry: HistoryEntryForLabel): string {
  const src = (entry.source ?? "").toLowerCase();
  const routing = (entry.routingStatus ?? "").toLowerCase();
  const fulfillment = (entry.fulfillmentStatus ?? "").toLowerCase();

  if (src.includes("admin_manual_recovery")) return "Manually recovered by admin";
  if (src === "manual" && routing === "confirmed") return "Routed manually";

  if (fulfillment === "cancelled") return "Cancelled";
  if (fulfillment === "completed") return "Completed";
  if (fulfillment === "ready") return "Ready";
  if (fulfillment === "preparing") return "Preparing";
  if (fulfillment === "accepted") return "Confirmed";
  if (fulfillment === "pending") return "Pending";

  if (routing === "failed") return "Routing failed";
  if (routing === "confirmed") return "Confirmed";
  if (routing === "sent") return "Sent";
  if (routing === "pending") return "Pending";

  if (fulfillment) return fulfillment.replace(/_/g, " ");
  if (routing) return routing.replace(/_/g, " ");
  return "Status update";
}
