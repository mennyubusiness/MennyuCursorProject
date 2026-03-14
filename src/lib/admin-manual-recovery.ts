/**
 * Detect manually recovered vendor orders for badges/context.
 * Manual recovery preserves routing failure in audit; ops override restores active flow.
 */

export interface VOForManualRecovery {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: Date | string | null;
}

export interface StatusHistoryEntry {
  source?: string | null;
}

/**
 * True when this vendor order was recovered via admin "Mark manually received".
 * Prefer explicitly set manuallyRecoveredAt; fallback to statusHistory for backfill.
 */
export function isManuallyRecovered(
  vo: VOForManualRecovery,
  statusHistory?: StatusHistoryEntry[] | null
): boolean {
  if (vo.fulfillmentStatus === "pending") return false;
  const routingFailedOrPending =
    vo.routingStatus === "failed" || vo.routingStatus === "pending";
  if (!routingFailedOrPending) return false;
  if (vo.manuallyRecoveredAt != null) return true;
  return statusHistory?.some((h) => h.source === "admin_manual_recovery") ?? false;
}
