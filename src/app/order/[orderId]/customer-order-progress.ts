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

/** Highest fulfillment step among vendor orders (drives parent timeline within `in_progress`). */
const FULFILLMENT_STEP_MAX: Record<string, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: 0,
};

export function maxParentFulfillmentStepRank(
  vendorOrders: Array<{ fulfillmentStatus: string }> | undefined
): number {
  if (!vendorOrders?.length) return 0;
  return vendorOrders.reduce(
    (m, v) => Math.max(m, FULFILLMENT_STEP_MAX[v.fulfillmentStatus] ?? 0),
    0
  );
}

/** Slowest vendor line (bottleneck); drives conservative customer copy so messaging does not outpace any line. */
export function minParentFulfillmentStepRank(
  vendorOrders: Array<{ fulfillmentStatus: string }> | undefined
): number {
  if (!vendorOrders?.length) return 0;
  const ranks = vendorOrders
    .filter((v) => v.fulfillmentStatus !== "cancelled")
    .map((v) => FULFILLMENT_STEP_MAX[v.fulfillmentStatus] ?? 0);
  if (!ranks.length) return 0;
  return Math.min(...ranks);
}

/**
 * Five-step parent journey: Received → Confirmed → Preparing → Ready → Completed.
 * Does not replace domain status; visual grouping only.
 */
export function buildParentOrderProgressSteps(
  derivedStatus: string,
  failedButRecoverable: boolean,
  vendorOrders?: Array<{ fulfillmentStatus: string; routingStatus?: string }>
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
    const rank = maxParentFulfillmentStepRank(vendorOrders);
    const received: ParentProgressStep = {
      key: "received",
      label: "Order received",
      shortLabel: "Received",
      state: "complete",
    };
    const confirmedComplete: ParentProgressStep = {
      key: "confirm",
      label: "Restaurant accepted order",
      shortLabel: "Confirmed",
      state: "complete",
    };
    const prepComplete: ParentProgressStep = {
      key: "prep",
      label: "Preparing",
      shortLabel: "Preparing",
      state: "complete",
    };

    // Only explicit POS acceptance (or higher) — not transport webhooks alone.
    if (rank <= 1) {
      return [
        received,
        {
          key: "confirm",
          label: "Restaurant confirmed your order",
          shortLabel: "Confirmed",
          state: "current",
        },
        {
          key: "prep",
          label: "Preparing your food",
          shortLabel: "Preparing",
          state: "upcoming",
        },
        { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
        { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
      ];
    }
    if (rank === 2) {
      return [
        received,
        confirmedComplete,
        {
          key: "prep",
          label: "Preparing your food",
          shortLabel: "Preparing",
          state: "current",
        },
        { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
        { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
      ];
    }
    // At least one vendor line is ready (rank ≥ 3).
    return [
      received,
      confirmedComplete,
      prepComplete,
      {
        key: "ready",
        label: "Ready for pickup",
        shortLabel: "Ready",
        state: "current",
      },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  if (d === "paid" || d === "routing" || d === "routed_partial" || d === "routed") {
    return [
      { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
      {
        key: "confirm",
        label: "Waiting for restaurant confirmation",
        shortLabel: "Confirming",
        state: "current",
      },
      { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "upcoming" },
      { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
      { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
    ];
  }

  return [
    { key: "received", label: "Order received", shortLabel: "Received", state: "complete" },
    {
      key: "confirm",
      label: "Waiting for restaurant confirmation",
      shortLabel: "Confirming",
      state: "current",
    },
    { key: "prep", label: "Preparing", shortLabel: "Preparing", state: "upcoming" },
    { key: "ready", label: "Ready for pickup", shortLabel: "Ready", state: "upcoming" },
    { key: "done", label: "Completed", shortLabel: "Done", state: "upcoming" },
  ];
}

/**
 * Per-vendor customer stages (maps to {@link VendorCustomerStatusStrip}).
 * Aligns with: Received → Confirmed → Preparing → Ready → Completed.
 */
export type VendorStageKey = "received" | "confirmed" | "kitchen" | "ready" | "done" | "stopped";

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
  if (vo.fulfillmentStatus === "preparing") return "kitchen";
  if (vo.fulfillmentStatus === "accepted") return "confirmed";
  return "received";
}
