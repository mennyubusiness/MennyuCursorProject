/**
 * Derived display/operational state for vendor orders.
 * Recoverable routing failure is distinct from terminal failure; manual recovery
 * restores active flow without erasing routing failure in audit.
 */

export type VendorOrderForEffectiveState = {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: Date | string | null;
  manuallyRecoveredBy?: string | null;
};

/** True when ops confirmed vendor received the order despite routing failure (audit preserved). */
export function isVendorOrderManuallyRecovered(
  vo: VendorOrderForEffectiveState,
  statusHistory?: Array<{ source?: string | null }> | null
): boolean {
  if (vo.fulfillmentStatus === "pending") return false;
  const routingFailedOrPending =
    vo.routingStatus === "failed" || vo.routingStatus === "pending";
  if (!routingFailedOrPending) return false;
  if (vo.manuallyRecoveredAt != null) return true;
  return statusHistory?.some((h) => h.source === "admin_manual_recovery") ?? false;
}

/**
 * True when the vendor order is considered "receipt confirmed" for lifecycle progression:
 * either automated routing confirmation or manual recovery. Use for transition eligibility
 * so manually recovered orders can progress (accepted → preparing → ready → completed).
 */
export function isVendorReceiptConfirmed(
  vo: VendorOrderForEffectiveState,
  statusHistory?: Array<{ source?: string | null }> | null
): boolean {
  if (vo.routingStatus === "confirmed") return true;
  return isVendorOrderManuallyRecovered(vo, statusHistory);
}

/** Terminal = explicitly cancelled; no further ops. */
export function isVendorOrderTerminalFailure(
  vo: VendorOrderForEffectiveState
): boolean {
  return vo.fulfillmentStatus === "cancelled";
}

/** Recoverable = routing failed, still pending fulfillment, not cancelled (can be retried or manually recovered). */
export function isVendorOrderRecoverableFailure(
  vo: VendorOrderForEffectiveState
): boolean {
  if (vo.routingStatus !== "failed") return false;
  if (vo.fulfillmentStatus !== "pending") return false;
  if (vo.fulfillmentStatus === "cancelled") return false;
  return !isVendorOrderManuallyRecovered(vo);
}

export type VendorOrderEffectiveDisplayState =
  | "active"
  | "needs_attention"
  | "recovered"
  | "ready"
  | "completed"
  | "cancelled"
  | "terminal_failed";

/** Single derived state for UI/grouping; not stored in DB. */
export function getVendorOrderEffectiveDisplayState(
  vo: VendorOrderForEffectiveState,
  statusHistory?: Array<{ source?: string | null }> | null
): VendorOrderEffectiveDisplayState {
  if (vo.fulfillmentStatus === "cancelled") return "cancelled";
  if (vo.fulfillmentStatus === "completed") return "completed";
  if (vo.fulfillmentStatus === "ready") return "ready";

  const recovered = isVendorOrderManuallyRecovered(vo, statusHistory);
  if (recovered && ["accepted", "preparing"].includes(vo.fulfillmentStatus)) {
    return "recovered";
  }

  if (vo.routingStatus === "failed" && vo.fulfillmentStatus === "pending") {
    return "needs_attention";
  }

  if (["accepted", "preparing"].includes(vo.fulfillmentStatus)) return "active";
  if (vo.fulfillmentStatus === "pending") return "active";

  return "terminal_failed";
}

/**
 * For parent order derivation: treat manually recovered VOs as confirmed so
 * parent status becomes in_progress instead of failed. Routing failure remains
 * in DB for audit.
 */
export function getEffectiveChildStateForParentDerivation(
  vo: VendorOrderForEffectiveState,
  statusHistory?: Array<{ source?: string | null }> | null
): {
  routingStatus: "pending" | "sent" | "confirmed" | "failed";
  fulfillmentStatus: string;
} {
  const recovered = isVendorOrderManuallyRecovered(vo, statusHistory);
  const routing = (vo.routingStatus || "pending") as "pending" | "sent" | "confirmed" | "failed";
  const fulfillment = vo.fulfillmentStatus || "pending";
  if (recovered) {
    return { routingStatus: "confirmed", fulfillmentStatus: fulfillment };
  }
  return { routingStatus: routing, fulfillmentStatus: fulfillment };
}
