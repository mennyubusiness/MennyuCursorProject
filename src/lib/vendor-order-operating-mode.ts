/**
 * Vendor-order operating mode for dashboard UI: what needs action and where to act (POS vs Mennyu).
 * Drives grouping, badges, and visibility of status controls.
 */
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";

export type VendorOrderOperatingMode =
  | "pos_synced"
  | "manual"
  | "fallback_required"
  | "needs_attention";

export interface VOForOperatingMode {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: Date | string | null;
}

export interface StatusHistoryEntryForMode {
  source?: string | null;
}

/**
 * Determines the operating mode for a vendor order from routing/fulfillment state and history.
 * Use isDeliverectLive from server (e.g. isRoutingRetryAvailable()) when rendering on client so mode is correct.
 */
export function getVendorOrderOperatingMode(
  vo: VOForOperatingMode,
  statusHistory?: StatusHistoryEntryForMode[] | null,
  isDeliverectLive?: boolean
): VendorOrderOperatingMode {
  const recovered = isManuallyRecovered(vo, statusHistory);
  const routingSentOrConfirmed = vo.routingStatus === "sent" || vo.routingStatus === "confirmed";
  const hasDeliverectInHistory = statusHistory?.some((h) => h.source === "deliverect") ?? false;

  // Needs action: routing failed, fulfillment still pending
  if (vo.routingStatus === "failed" && vo.fulfillmentStatus === "pending") {
    return "needs_attention";
  }

  // Fallback required: recovered by admin, or routing failed/pending but vendor progressed in Mennyu
  if (recovered) return "fallback_required";
  if (
    (vo.routingStatus === "failed" || vo.routingStatus === "pending") &&
    vo.fulfillmentStatus !== "pending"
  ) {
    return "fallback_required";
  }

  // POS synced: sent/confirmed, Deliverect live, not recovered
  if (routingSentOrConfirmed && (isDeliverectLive === true || hasDeliverectInHistory) && !recovered) {
    return "pos_synced";
  }

  // Manual: sent/confirmed via manual path or Mennyu-tracked (no Deliverect)
  if (routingSentOrConfirmed) return "manual";

  // Pending routing: treat as needs_attention so vendor knows to wait or use fallback
  if (vo.routingStatus === "pending" && vo.fulfillmentStatus === "pending") {
    return "needs_attention";
  }

  return "manual";
}

/** Badge label for the operating mode (shown on order card). For fallback_required, pass vo+history to distinguish Recovered vs Sync issue. */
export function getOperatingModeBadgeLabel(
  mode: VendorOrderOperatingMode,
  vo?: VOForOperatingMode,
  statusHistory?: StatusHistoryEntryForMode[] | null
): string {
  switch (mode) {
    case "pos_synced":
      return "POS synced";
    case "manual":
      return "Mennyu tracked";
    case "fallback_required":
      if (vo && isManuallyRecovered(vo, statusHistory)) return "Recovered";
      return "Sync issue";
    case "needs_attention":
      return "Needs attention";
    default:
      return "Mennyu tracked";
  }
}

/**
 * Hint for action block: when to use POS vs Mennyu. null = use default (Mennyu controls primary).
 */
export function getOperatingModeActionHint(
  mode: VendorOrderOperatingMode,
  vo?: VOForOperatingMode,
  isDeliverectLive?: boolean,
  /** Set when Deliverect VO is still pending/pending after the healthy routing wait window. */
  deliverectRoutingDegraded?: boolean
): string | null {
  if (deliverectRoutingDegraded === true) {
    return "Deliverect routing didn’t complete in time. Confirm manually only if this order already appears in your POS; otherwise contact support.";
  }
  switch (mode) {
    case "pos_synced":
      return "Update status in your POS. Use buttons below only if POS is not syncing.";
    case "fallback_required":
      return "Use Mennyu buttons below to update status (POS sync issue or recovered order).";
    case "needs_attention":
      if (vo?.routingStatus === "failed") {
        return "Routing to your POS failed. Use Deny if you can’t fulfill, or contact support for recovery.";
      }
      return "Confirm order in Mennyu or use fallback if you already received it.";
    case "manual":
    default:
      return null;
  }
}

/** Whether to show Mennyu status controls as primary (true) or as fallback/secondary (false). */
export function isMennyuControlsPrimary(mode: VendorOrderOperatingMode): boolean {
  return mode === "manual" || mode === "needs_attention" || mode === "fallback_required";
}
