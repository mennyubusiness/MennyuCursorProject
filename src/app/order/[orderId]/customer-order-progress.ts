/**
 * Pure UI mapping for customer order progress (uses existing parent + vendor statuses only).
 */
import type { ParentOrderStatus } from "@/domain/types";

export type ProgressStepUiState = "complete" | "current" | "upcoming" | "danger" | "skipped";

export type ParentProgressStep = {
  key: string;
  label: string;
  shortLabel: string;
  state: ProgressStepUiState;
};

/**
 * Five-step parent journey: received → confirming → preparing → ready → completed.
 * Does not replace domain status; visual grouping only.
 */
export function buildParentOrderProgressSteps(
  derivedStatus: string,
  failedButRecoverable: boolean
): ParentProgressStep[] {
  const d = derivedStatus as ParentOrderStatus;

  if (failedButRecoverable) {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      {
        key: "confirm",
        label: "Confirming with restaurants",
        shortLabel: "Confirming",
        state: "current",
      },
      { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "upcoming" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  if (d === "cancelled") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "", shortLabel: "…", state: "skipped" },
      { key: "prep", label: "", shortLabel: "…", state: "skipped" },
      { key: "ready", label: "", shortLabel: "…", state: "skipped" },
      { key: "done", label: "Order cancelled", shortLabel: "Cancelled", state: "danger" },
    ];
  }

  if (d === "failed") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "Issue occurred", shortLabel: "Issue", state: "danger" },
      { key: "prep", label: "", shortLabel: "…", state: "skipped" },
      { key: "ready", label: "", shortLabel: "…", state: "skipped" },
      { key: "done", label: "Could not complete", shortLabel: "Failed", state: "danger" },
    ];
  }

  if (d === "completed") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "Restaurants confirmed", shortLabel: "Confirmed", state: "complete" },
      { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "complete" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "complete" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "complete" },
    ];
  }

  if (d === "ready") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "Restaurants confirmed", shortLabel: "Confirmed", state: "complete" },
      { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "complete" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "current" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  if (
    d === "accepted" ||
    d === "preparing" ||
    d === "in_progress" ||
    d === "partially_completed"
  ) {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "Restaurants confirmed", shortLabel: "Confirmed", state: "complete" },
      { key: "prep", label: "Preparing your food", shortLabel: "Preparing", state: "current" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  if (d === "paid" || d === "routing" || d === "routed_partial" || d === "routed") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      { key: "confirm", label: "Confirming with restaurants", shortLabel: "Confirming", state: "current" },
      { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "upcoming" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  // pending_payment not shown on this page typically; treat as early
  return [
    { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
    { key: "confirm", label: "Confirming with restaurants", shortLabel: "Confirming", state: "current" },
    { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "upcoming" },
    { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
    { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
  ];
}

export type VendorStageKey = "confirming" | "kitchen" | "ready" | "done" | "stopped";

/** Per-vendor stage for customer UI (no new statuses). */
export function getVendorCustomerStage(
  vo: {
    routingStatus: string;
    fulfillmentStatus: string;
  },
  isManuallyRecovered?: boolean
): VendorStageKey {
  if (vo.fulfillmentStatus === "cancelled") return "stopped";
  if (vo.routingStatus === "failed" && !isManuallyRecovered) return "stopped";
  if (vo.fulfillmentStatus === "completed") return "done";
  if (vo.fulfillmentStatus === "ready") return "ready";
  if (vo.fulfillmentStatus === "preparing" || vo.fulfillmentStatus === "accepted") return "kitchen";
  return "confirming";
}
