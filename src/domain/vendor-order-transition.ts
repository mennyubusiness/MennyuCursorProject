/**
 * Vendor order state transition rules (routing + fulfillment).
 * Shared by dev simulator and vendor dashboard so both use the same lifecycle.
 */
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "./types";

export type VendorOrderTargetState =
  | "sent"
  | "confirmed"
  | "accepted"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "failed";

const TERMINAL_FULFILLMENT = new Set<VendorOrderFulfillmentStatus>(["completed", "cancelled"]);

/**
 * Routing "failed" is only terminal when fulfillment is still pending (unresolved).
 * Once manual recovery has moved fulfillment to accepted or beyond, allow normal fulfillment progression.
 */
function isRoutingTerminalForProgression(
  currentRouting: VendorOrderRoutingStatus,
  currentFulfillment: VendorOrderFulfillmentStatus
): boolean {
  return currentRouting === "failed" && currentFulfillment === "pending";
}

/**
 * Validate that transitioning from (routing, fulfillment) to target is allowed.
 * Returns error message or null if valid.
 * @param source - Optional. "admin" allows cancel from failed/pending; "admin_manual_recovery" allows accepted from failed/pending (fulfillment only, routing unchanged).
 * @param isReceiptConfirmed - Optional. When true, treat as receipt confirmed for fulfillment progression (e.g. manually recovered); avoids "Routing must be confirmed" for accepted → preparing → ready → completed.
 */
export function validateTransition(
  currentRouting: VendorOrderRoutingStatus,
  currentFulfillment: VendorOrderFulfillmentStatus,
  target: VendorOrderTargetState,
  source?: string,
  isReceiptConfirmed?: boolean
): string | null {
  const adminManualRecovery = source === "admin_manual_recovery";
  const adminCancel = source === "admin" && target === "cancelled";

  if (isRoutingTerminalForProgression(currentRouting, currentFulfillment)) {
    if (adminCancel) return null;
    if (adminManualRecovery && target === "accepted") return null;
    return "Vendor order routing is terminal (failed); no further transitions.";
  }
  if (TERMINAL_FULFILLMENT.has(currentFulfillment)) {
    return "Vendor order fulfillment is terminal (completed/cancelled); no further transitions.";
  }

  const routingOkForFulfillment =
    isReceiptConfirmed === true ||
    currentRouting === "confirmed" ||
    (currentRouting === "failed" && currentFulfillment !== "pending");

  switch (target) {
    case "sent":
      return currentRouting !== "pending" ? "Only pending can transition to sent." : null;
    case "confirmed":
      if (currentRouting === "pending" || currentRouting === "sent") return null;
      return "Only pending/sent can transition to confirmed.";
    case "failed":
      if (currentRouting === "confirmed" && currentFulfillment !== "pending")
        return "Cannot set failed after fulfillment started.";
      return null;
    case "accepted":
      if (adminManualRecovery && (currentRouting === "failed" || currentRouting === "pending"))
        return null;
      if (currentRouting !== "confirmed") return "Routing must be confirmed before accepted.";
      return currentFulfillment !== "pending" ? "Only pending fulfillment can transition to accepted." : null;
    case "preparing":
      if (!routingOkForFulfillment) return "Routing must be confirmed.";
      return currentFulfillment !== "accepted" ? "Only accepted can transition to preparing." : null;
    case "ready":
      if (!routingOkForFulfillment) return "Routing must be confirmed.";
      return currentFulfillment !== "preparing" ? "Only preparing can transition to ready." : null;
    case "completed":
      if (!routingOkForFulfillment) return "Routing must be confirmed.";
      return currentFulfillment !== "ready" ? "Only ready can transition to completed." : null;
    case "cancelled":
      if (adminCancel) return null;
      if (currentFulfillment === "pending" || currentFulfillment === "accepted") return null;
      return "Cannot cancel once preparation has started.";
    default:
      return "Unknown target state.";
  }
}

const PROGRESSION_TARGETS: VendorOrderTargetState[] = [
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

/**
 * Returns target states that are valid next steps from (routing, fulfillment) for normal lifecycle progression.
 * Used by admin UI to show only valid transition options (no admin exception source).
 */
export function getAllowedProgressionTargets(
  currentRouting: VendorOrderRoutingStatus,
  currentFulfillment: VendorOrderFulfillmentStatus
): VendorOrderTargetState[] {
  return PROGRESSION_TARGETS.filter(
    (t) => validateTransition(currentRouting, currentFulfillment, t) === null
  );
}

/**
 * Map target state to (routingStatus, fulfillmentStatus) update.
 * Only includes fields that change.
 */
export function targetToUpdate(
  target: VendorOrderTargetState
): { routingStatus?: VendorOrderRoutingStatus; fulfillmentStatus?: VendorOrderFulfillmentStatus } {
  switch (target) {
    case "sent":
      return { routingStatus: "sent" };
    case "confirmed":
      return { routingStatus: "confirmed" };
    case "failed":
      return { routingStatus: "failed" };
    case "accepted":
      return { fulfillmentStatus: "accepted" };
    case "preparing":
      return { fulfillmentStatus: "preparing" };
    case "ready":
      return { fulfillmentStatus: "ready" };
    case "completed":
      return { fulfillmentStatus: "completed" };
    case "cancelled":
      return { fulfillmentStatus: "cancelled" };
    default:
      return {};
  }
}
