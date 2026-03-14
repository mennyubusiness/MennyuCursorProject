/**
 * Routing/source labels for vendor orders on the vendor dashboard.
 * Derives from routingStatus, fulfillmentStatus, and optional statusHistory.
 * Reuses manual-recovery detection from admin; no new state system.
 * Only shows "POS / Deliverect synced" when ROUTING_MODE=deliverect (integration live).
 */

import { isManuallyRecovered } from "@/lib/admin-manual-recovery";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";

export type VendorOrderSourceLabel =
  | "POS / Deliverect synced"
  | "Mennyu tracked order"
  | "Routing pending"
  | "Routing failed"
  | "Recovered manually"
  | "Mennyu fallback";

export interface VOForSourceLabel {
  routingStatus: string;
  fulfillmentStatus: string;
}

export interface StatusHistoryEntryForSource {
  source?: string | null;
}

/**
 * Returns the operational source/status label for a vendor order.
 * Used on vendor dashboard cards so vendors know whether POS is authoritative or fallback applies.
 * When Deliverect is not live (ROUTING_MODE !== "deliverect"), uses "Mennyu tracked order" instead of "POS / Deliverect synced".
 */
export function getVendorOrderSourceLabel(
  vo: VOForSourceLabel,
  statusHistory?: StatusHistoryEntryForSource[] | null
): VendorOrderSourceLabel {
  const hasAdminRecovery = statusHistory?.some((h) => h.source === "admin_manual_recovery");
  if (hasAdminRecovery && isManuallyRecovered(vo, statusHistory)) return "Recovered manually";

  if (vo.routingStatus === "failed") return "Routing failed";
  if (vo.routingStatus === "pending") return "Routing pending";

  // sent | confirmed → show "POS / Deliverect synced" only when integration is live
  if (vo.routingStatus === "sent" || vo.routingStatus === "confirmed") {
    return isRoutingRetryAvailable() ? "POS / Deliverect synced" : "Mennyu tracked order";
  }

  // Routing failed/pending but fulfillment moved (dashboard fallback, no admin recovery)
  if (vo.fulfillmentStatus !== "pending") return "Mennyu fallback";

  return "Routing pending";
}
