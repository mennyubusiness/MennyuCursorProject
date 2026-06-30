/**
 * Manual dashboard fulfillment: skip-ahead transitions and kitchen secondary actions.
 * Used by vendor dashboard API and Kitchen Mode for orderRoutingMode === manual_dashboard.
 */
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "@/domain/types";
import {
  targetToUpdate,
  validateTransition,
  type VendorOrderTargetState,
} from "@/domain/vendor-order-transition";

const TERMINAL_FULFILLMENT = new Set<VendorOrderFulfillmentStatus>(["completed", "cancelled"]);
const PRE_ACCEPT_ROUTING = new Set<VendorOrderRoutingStatus>(["pending", "sent", "confirmed"]);

export type VendorDashboardTransitionPatch = {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
};

function routingOkForFulfillment(
  routing: VendorOrderRoutingStatus,
  receiptConfirmed?: boolean
): boolean {
  return (
    receiptConfirmed === true ||
    routing === "confirmed" ||
    routing === "sent" ||
    (routing === "failed" && false)
  );
}

/** True when patch would leave routing + fulfillment unchanged. */
export function isVendorDashboardTransitionNoOp(
  currentRouting: VendorOrderRoutingStatus,
  currentFulfillment: VendorOrderFulfillmentStatus,
  patch: VendorDashboardTransitionPatch
): boolean {
  const nextRouting = patch.routingStatus ?? currentRouting;
  const nextFulfillment = patch.fulfillmentStatus ?? currentFulfillment;
  return nextRouting === currentRouting && nextFulfillment === currentFulfillment;
}

/**
 * Resolve routing/fulfillment patch for vendor dashboard transitions.
 * Strict step-by-step first; optional skip-ahead for manual_dashboard vendors.
 */
export function resolveVendorDashboardTransitionPatch(
  currentRouting: VendorOrderRoutingStatus,
  currentFulfillment: VendorOrderFulfillmentStatus,
  target: VendorOrderTargetState,
  options?: { receiptConfirmed?: boolean; allowSkipAhead?: boolean }
): { patch: VendorDashboardTransitionPatch; error: string | null } {
  const { receiptConfirmed, allowSkipAhead } = options ?? {};

  const strictErr = validateTransition(
    currentRouting,
    currentFulfillment,
    target,
    "vendor_dashboard",
    receiptConfirmed
  );
  if (strictErr === null) {
    return { patch: targetToUpdate(target), error: null };
  }

  if (!allowSkipAhead) {
    return { patch: {}, error: strictErr };
  }

  if (TERMINAL_FULFILLMENT.has(currentFulfillment)) {
    return {
      patch: {},
      error: "Vendor order fulfillment is terminal (completed/cancelled); no further transitions.",
    };
  }

  const patch: VendorDashboardTransitionPatch = {};

  switch (target) {
    case "accepted": {
      if (currentFulfillment === "accepted") return { patch: {}, error: null };
      if (currentFulfillment !== "pending") return { patch: {}, error: strictErr };
      if (currentRouting === "pending") {
        patch.routingStatus = "confirmed";
        patch.fulfillmentStatus = "accepted";
        return { patch, error: null };
      }
      return { patch: {}, error: strictErr };
    }
    case "preparing": {
      if (currentFulfillment === "preparing") return { patch: {}, error: null };
      if (currentFulfillment === "accepted") return { patch: {}, error: strictErr };
      if (currentFulfillment !== "pending") {
        return { patch: {}, error: "Cannot skip to preparing from current fulfillment state." };
      }
      if (!PRE_ACCEPT_ROUTING.has(currentRouting)) {
        return { patch: {}, error: "Cannot skip to preparing from current routing state." };
      }
      if (currentRouting === "pending") patch.routingStatus = "confirmed";
      patch.fulfillmentStatus = "preparing";
      return { patch, error: null };
    }
    case "ready": {
      if (currentFulfillment === "ready") return { patch: {}, error: null };
      if (currentFulfillment === "preparing") {
        return { patch: targetToUpdate("ready"), error: null };
      }
      if (currentFulfillment === "accepted") {
        if (!routingOkForFulfillment(currentRouting, receiptConfirmed)) {
          return { patch: {}, error: "Routing must be confirmed." };
        }
        patch.fulfillmentStatus = "ready";
        return { patch, error: null };
      }
      if (currentFulfillment === "pending") {
        if (!PRE_ACCEPT_ROUTING.has(currentRouting)) {
          return { patch: {}, error: "Cannot skip to ready from current routing state." };
        }
        if (currentRouting === "pending") patch.routingStatus = "confirmed";
        patch.fulfillmentStatus = "ready";
        return { patch, error: null };
      }
      return { patch: {}, error: strictErr };
    }
    case "completed": {
      if (currentFulfillment === "completed") return { patch: {}, error: null };
      if (currentFulfillment === "ready") {
        return { patch: targetToUpdate("completed"), error: null };
      }
      if (currentFulfillment === "preparing") {
        if (!routingOkForFulfillment(currentRouting, receiptConfirmed)) {
          return { patch: {}, error: "Routing must be confirmed." };
        }
        patch.fulfillmentStatus = "completed";
        return { patch, error: null };
      }
      return { patch: {}, error: strictErr };
    }
    default:
      return { patch: {}, error: strictErr };
  }
}

/** Secondary skip-ahead actions for Kitchen Mode (manual dashboard only). */
export function getVendorKitchenSkipAheadActions(
  routingStatus: string,
  fulfillmentStatus: string,
  primaryTarget: string | null | undefined
): Array<{ targetState: VendorOrderTargetState; label: string }> {
  const actions: Array<{ targetState: VendorOrderTargetState; label: string }> = [];
  const primary = primaryTarget ?? null;

  if (fulfillmentStatus === "pending" && PRE_ACCEPT_ROUTING.has(routingStatus as VendorOrderRoutingStatus)) {
    if (primary !== "preparing") {
      actions.push({ targetState: "preparing", label: "Skip to preparing" });
    }
    if (primary !== "ready") {
      actions.push({ targetState: "ready", label: "Skip to ready" });
    }
  }

  if (fulfillmentStatus === "accepted" && primary !== "ready") {
    actions.push({ targetState: "ready", label: "Skip to ready" });
  }

  if (fulfillmentStatus === "preparing" && primary !== "completed") {
    actions.push({ targetState: "completed", label: "Complete without ready step" });
  }

  return actions;
}
