/**
 * Order state machine: parent order + child vendor orders.
 * Parent status is derived from child states for unified customer display.
 * POS (Deliverect) is source of truth when available; fallback flow scaffolded.
 */

import type {
  ParentOrderStatus,
  VendorOrderRoutingStatus,
  VendorOrderFulfillmentStatus,
} from "./types";

export const PARENT_ORDER_STATUSES: ParentOrderStatus[] = [
  "pending_payment",
  "paid",
  "routing",
  "routed_partial",
  "routed",
  "accepted",
  "preparing",
  "ready",
  "in_progress",
  "partially_completed",
  "completed",
  "cancelled",
  "failed",
];

export const ROUTING_STATUSES: VendorOrderRoutingStatus[] = [
  "pending",
  "sent",
  "confirmed",
  "failed",
];

export const FULFILLMENT_STATUSES: VendorOrderFulfillmentStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export interface ChildOrderState {
  routingStatus: VendorOrderRoutingStatus;
  fulfillmentStatus: VendorOrderFulfillmentStatus;
}

/**
 * Derive parent order status from child vendor orders.
 * Fulfillment/terminal outcomes take precedence over routing: the parent must not stay in
 * "routing" once any child has reached accepted, preparing, ready, completed, cancelled, or failed.
 */
export function deriveParentStatusFromChildren(
  children: ChildOrderState[]
): ParentOrderStatus {
  if (children.length === 0) return "routing";

  const allRoutingFailed = children.every((c) => c.routingStatus === "failed");
  if (allRoutingFailed) return "failed";

  const hasChildBeyondRouting = children.some(
    (c) =>
      c.fulfillmentStatus !== "pending" ||
      c.routingStatus === "failed"
  );

  if (hasChildBeyondRouting) {
    const completedCount = children.filter((c) => c.fulfillmentStatus === "completed").length;
    const cancelledCount = children.filter((c) => c.fulfillmentStatus === "cancelled").length;
    const routingFailedCount = children.filter((c) => c.routingStatus === "failed").length;
    const activeFulfillmentCount = children.filter((c) =>
      ["accepted", "preparing", "ready"].includes(c.fulfillmentStatus)
    ).length;
    const activeAllReady =
      activeFulfillmentCount > 0 &&
      children
        .filter((c) => ["accepted", "preparing", "ready"].includes(c.fulfillmentStatus))
        .every((c) => c.fulfillmentStatus === "ready");
    const stillInRoutingCount = children.filter(
      (c) => c.fulfillmentStatus === "pending" && c.routingStatus !== "failed"
    ).length;

    if (completedCount === children.length) return "completed";
    if (cancelledCount === children.length) return "cancelled";

    // Multi-vendor: once every child is fulfillment-terminal (completed or cancelled), the parent
    // should complete if any line fulfilled — cancelled lines do not block (e.g. completed + cancelled).
    const allFulfillmentTerminal = children.every(
      (c) => c.fulfillmentStatus === "completed" || c.fulfillmentStatus === "cancelled"
    );
    if (allFulfillmentTerminal && completedCount > 0) return "completed";

    if (
      completedCount === 0 &&
      (routingFailedCount + cancelledCount === children.length)
    )
      return "failed";
    if (completedCount > 0 && (cancelledCount > 0 || routingFailedCount > 0))
      return "partially_completed";
    if (activeFulfillmentCount > 0 || stillInRoutingCount > 0) {
      if (activeAllReady && stillInRoutingCount === 0) return "ready";
      return "in_progress";
    }

    return "failed";
  }

  const allSent = children.every((c) => c.routingStatus === "sent" || c.routingStatus === "confirmed");
  const anyRoutingFailed = children.some((c) => c.routingStatus === "failed");
  const someSent = children.some((c) => c.routingStatus === "sent");
  const allConfirmed = children.every((c) => c.routingStatus === "confirmed");

  if (!allSent) return "routing";
  if (anyRoutingFailed) return "routed_partial";
  if (someSent && !allConfirmed) return "routed_partial";
  if (!allConfirmed) return "routed";

  return "routed";
}

/**
 * Map Deliverect webhook event to vendor order routing/fulfillment status.
 * Stub: implement exact mapping when Deliverect event types are confirmed.
 */
export function mapDeliverectEventToStatus(
  eventType: string,
  _payload?: unknown
): { routingStatus?: VendorOrderRoutingStatus; fulfillmentStatus?: VendorOrderFulfillmentStatus } {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("confirm") || normalized.includes("accepted")) {
    return { routingStatus: "confirmed", fulfillmentStatus: "accepted" };
  }
  if (normalized.includes("preparing") || normalized.includes("in_preparation")) {
    return { fulfillmentStatus: "preparing" };
  }
  if (normalized.includes("ready") || normalized.includes("ready_for_pickup")) {
    return { fulfillmentStatus: "ready" };
  }
  if (normalized.includes("completed") || normalized.includes("done")) {
    return { fulfillmentStatus: "completed" };
  }
  if (normalized.includes("cancel")) {
    return { fulfillmentStatus: "cancelled" };
  }
  if (normalized.includes("reject") || normalized.includes("failed")) {
    return { routingStatus: "failed" };
  }
  return {};
}

/**
 * Admin dashboards: operational wording aligned with how orders behave in the product
 * (vendor approval / routing), not internal transport jargon like "partially sent to vendors".
 */
export function adminOperationalParentStatusLabel(
  status: ParentOrderStatus,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>
): string {
  if (status === "routed" || status === "routed_partial") {
    return customerOrderHeaderStatus(status, vendorOrders);
  }
  return parentStatusLabel(status);
}

/**
 * Human-readable label for order status (admin, internal).
 */
export function parentStatusLabel(status: ParentOrderStatus): string {
  const labels: Record<ParentOrderStatus, string> = {
    pending_payment: "Pending payment",
    paid: "Payment received",
    routing: "Sending to vendors…",
    routed_partial: "Partially sent to vendors",
    routed: "Sent to vendors",
    accepted: "In progress",
    preparing: "In progress",
    ready: "Ready for pickup",
    in_progress: "In progress",
    partially_completed: "Partially completed",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Order failed",
  };
  return labels[status] ?? status;
}

/**
 * Customer-facing parent order header (short line). Uses explicit single- vs multi-vendor
 * phrasing only for `routed_partial` (partially accepted).
 */
export function customerOrderHeaderStatus(
  status: ParentOrderStatus,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>
): string {
  const isMultiVendor = vendorOrders.length > 1;
  switch (status) {
    case "pending_payment":
      return "Awaiting payment";
    case "paid":
    case "routing":
    case "routed":
      return "Confirming your order";
    case "routed_partial":
      return isMultiVendor ? "Partially accepted" : "Confirming your order";
    case "accepted":
    case "preparing":
    case "in_progress":
    case "partially_completed":
      return "In progress";
    case "ready":
      return "Ready for pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return parentStatusLabel(status);
  }
}

/** @deprecated Use customerOrderHeaderStatus with vendor order rows for multi-vendor accuracy */
export function customerStatusLabelForRouted(
  status: ParentOrderStatus,
  vendorOrderCount: number
): string {
  const stub = Array.from({ length: Math.max(1, vendorOrderCount) }, () => ({
    routingStatus: "sent",
    fulfillmentStatus: "pending",
  }));
  return customerOrderHeaderStatus(status, stub);
}

/**
 * Customer-facing labels for parent order rows in "Recent updates" timeline (not admin parentStatusLabel).
 * Multi-vendor only changes copy for `routed_partial` → "Partially accepted".
 */
export function customerOrderTimelineParentLabel(
  status: ParentOrderStatus,
  isMultiVendor: boolean
): string {
  switch (status) {
    case "pending_payment":
      return "Order placed";
    case "paid":
    case "routing":
    case "routed":
      return "Confirming your order";
    case "routed_partial":
      return isMultiVendor ? "Partially accepted" : "Confirming your order";
    case "accepted":
    case "preparing":
    case "in_progress":
    case "partially_completed":
      return "In progress";
    case "ready":
      return "Ready for pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return parentStatusLabel(status);
  }
}

/**
 * Whether the order is in a terminal state (no further updates expected).
 */
export function isTerminalStatus(status: ParentOrderStatus): boolean {
  return ["completed", "partially_completed", "cancelled", "failed"].includes(status);
}

/**
 * Derive parent routing status after Deliverect submit attempts.
 * Use after submitting all vendor orders; then set order status to result.
 */
export function deriveParentRoutingStatusFromAttempts(
  routingStatuses: Array<"pending" | "sent" | "confirmed" | "failed">
): "routed" | "routed_partial" | "failed" {
  if (routingStatuses.length === 0) return "routed";
  const allFailed = routingStatuses.every((s) => s === "failed");
  if (allFailed) return "failed";
  const anyFailed = routingStatuses.some((s) => s === "failed");
  const anySentOrConfirmed = routingStatuses.some((s) => s === "sent" || s === "confirmed");
  if (anyFailed && anySentOrConfirmed) return "routed_partial";
  return "routed";
}
