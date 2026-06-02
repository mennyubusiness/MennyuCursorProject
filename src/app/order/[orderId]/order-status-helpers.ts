/**
 * Shared pure helpers for customer order status display (server and client).
 */
import {
  customerOrderHeaderStatus,
  customerOrderTimelineParentLabel,
} from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import {
  maxParentFulfillmentStepRank,
  minParentFulfillmentStepRank,
} from "./customer-order-progress";
import { formatPickupSummaryScheduledLead } from "@/lib/pickup-display";
import type { OrderPickupDisplayInput } from "@/lib/pickup-display";
import {
  customerRefundDisplayMessage,
  isPartialRefundDisplay,
  pickLatestCustomerRefundDisplay,
} from "@/lib/customer-refund-display";

/**
 * Customer-facing vendor order chip: Deliverect / fulfillment progression.
 * DB has no separate "prepared" state; `ready` maps to "Ready for pickup".
 */
export function vendorStatusLabel(
  routingStatus: string,
  fulfillmentStatus: string,
  isManuallyRecovered?: boolean
): string {
  if (routingStatus === "failed" && !isManuallyRecovered) return "Failed";
  if (fulfillmentStatus === "cancelled") return "Cancelled";
  if (fulfillmentStatus === "completed") return "Completed";
  if (fulfillmentStatus === "ready") return "Ready for pickup";
  if (fulfillmentStatus === "preparing") return "Preparing";
  if (fulfillmentStatus === "accepted") return "Confirmed";
  if (fulfillmentStatus === "pending") {
    if (routingStatus === "sent" || routingStatus === "confirmed" || routingStatus === "pending") {
      return "Received";
    }
  }
  return "Received";
}

/**
 * True when a future scheduled pickup is still before active kitchen work (no preparing/ready yet).
 * Used for customer-facing "Scheduled" labels only; does not change stored status.
 */
export function shouldShowScheduledPickupCustomerLabels(
  requestedPickupAt: unknown,
  vendorOrders: Array<{ fulfillmentStatus: string }>
): boolean {
  if (requestedPickupAt == null) return false;
  return !vendorOrders.some((v) => ["preparing", "ready"].includes(v.fulfillmentStatus));
}

/**
 * Customer vendor row: show "Scheduled" for future pickup until POS moves into preparing or later.
 */
export function vendorStatusLabelForScheduledPickup(
  requestedPickupAt: unknown,
  routingStatus: string,
  fulfillmentStatus: string,
  isManuallyRecovered?: boolean
): string {
  if (routingStatus === "failed" && !isManuallyRecovered) return "Failed";
  if (fulfillmentStatus === "cancelled") return "Cancelled";
  if (fulfillmentStatus === "completed") return "Completed";
  if (
    requestedPickupAt != null &&
    (fulfillmentStatus === "pending" || fulfillmentStatus === "accepted")
  ) {
    return "Scheduled";
  }
  return vendorStatusLabel(routingStatus, fulfillmentStatus, isManuallyRecovered);
}

/**
 * Parent header: show "Scheduled" when the order is future-scheduled but derived parent status
 * already reflects confirmed vendor rows (→ "In progress") before any kitchen prep has started.
 */
export function customerStatusLabelForScheduledPickup(
  derivedStatus: string,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>,
  failedButRecoverable: boolean,
  requestedPickupAt: unknown
): string {
  if (failedButRecoverable) return "Confirming your order";
  if (
    requestedPickupAt != null &&
    shouldShowScheduledPickupCustomerLabels(requestedPickupAt, vendorOrders) &&
    (derivedStatus === "in_progress" ||
      derivedStatus === "accepted" ||
      derivedStatus === "preparing")
  ) {
    return "Scheduled";
  }
  return customerStatusLabel(derivedStatus, vendorOrders, failedButRecoverable);
}

/**
 * Customer-facing line tied to the slowest vendor fulfillment line (min rank) so copy never
 * implies a stage ahead of any vendor row.
 */
function orderStageLineFromMinRank(minRank: number, multi: boolean): string {
  if (minRank <= 0) return "Your order has been received.";
  if (minRank === 1) {
    return multi
      ? "Restaurants have confirmed your order."
      : "The restaurant confirmed your order.";
  }
  if (minRank === 2) {
    return multi
      ? "The restaurants are preparing your order."
      : "The restaurant is preparing your order.";
  }
  if (minRank === 3) return "Your order is ready for pickup.";
  return "Order completed.";
}

export function orderSummaryExplanation(
  derivedStatus: string,
  vendorOrders: Array<{ fulfillmentStatus: string; routingStatus: string }>,
  requestedPickupAt?: unknown,
  /** When set, scheduled-summary copy uses the same wall time as {@link formatPickupDetailLine}. */
  pickupDisplay?: OrderPickupDisplayInput
): string {
  const multi = vendorOrders.length > 1;
  const minRank = minParentFulfillmentStepRank(vendorOrders);
  const maxRank = maxParentFulfillmentStepRank(vendorOrders);
  const total = vendorOrders.length;

  if (derivedStatus === "completed") {
    return "Order completed.";
  }
  if (derivedStatus === "cancelled") return "This order was cancelled.";

  if (derivedStatus === "failed") {
    const allRecoverable =
      vendorOrders.length > 0 &&
      vendorOrders.every(
        (v) =>
          v.fulfillmentStatus === "cancelled" ||
          (v.routingStatus === "failed" && v.fulfillmentStatus === "pending")
      );
    if (allRecoverable)
      return "We're confirming your order. We'll update you shortly.";
    return "We couldn't complete this order. Contact us if you need help.";
  }

  if (derivedStatus === "ready") {
    return "Your order is ready for pickup.";
  }

  if (derivedStatus === "partially_completed") {
    return "Part of your order is complete; we'll update you on the rest.";
  }

  const scheduledPreKitchen =
    requestedPickupAt != null &&
    shouldShowScheduledPickupCustomerLabels(requestedPickupAt, vendorOrders) &&
    (derivedStatus === "in_progress" ||
      derivedStatus === "accepted" ||
      derivedStatus === "preparing") &&
    maxRank < 2;

  if (scheduledPreKitchen) {
    const scheduledLead =
      pickupDisplay != null ? formatPickupSummaryScheduledLead(pickupDisplay) : null;
    const first = scheduledLead ?? "Your pickup is scheduled.";
    return `${first} ${orderStageLineFromMinRank(minRank, multi)}`;
  }

  if (
    derivedStatus === "in_progress" ||
    derivedStatus === "accepted" ||
    derivedStatus === "preparing"
  ) {
    if (vendorOrders.length === 0) {
      return "We'll send updates to your phone as things progress.";
    }
    const ready = vendorOrders.filter((v) => v.fulfillmentStatus === "ready").length;
    const stillKitchen = vendorOrders.filter((v) =>
      ["accepted", "preparing"].includes(v.fulfillmentStatus)
    ).length;
    if (multi && ready > 0 && stillKitchen > 0) {
      return `${ready} ${ready === 1 ? "vendor has" : "vendors have"} your items ready; ${stillKitchen} ${stillKitchen === 1 ? "is" : "are"} still preparing.`;
    }
    if (!multi && ready > 0) return "Your order is ready for pickup.";
    if (multi && ready > 0 && stillKitchen === 0) return "Your items are ready for pickup.";
    return orderStageLineFromMinRank(minRank, multi);
  }

  if (derivedStatus === "routing") {
    return multi
      ? "Each vendor is getting your order. You'll see updates as they confirm."
      : "Your order has been received.";
  }
  if (derivedStatus === "routed_partial" && multi) {
    const confirmed = vendorOrders.filter((v) => v.routingStatus === "confirmed").length;
    if (confirmed > 0 && confirmed < total)
      return "Some vendors have already confirmed; we're waiting on the others.";
    return "We're waiting on each vendor to confirm your order.";
  }
  if (derivedStatus === "routed" || derivedStatus === "routed_partial") {
    return multi
      ? "You'll get updates as each vendor confirms."
      : "You'll get updates as soon as the restaurant confirms.";
  }
  if (derivedStatus === "paid" || derivedStatus === "pending_payment") {
    return multi ? "We're getting your order to each vendor." : "We're getting your order to the restaurant.";
  }
  return "We'll send updates to your phone as things progress.";
}

export function timelineEntryLabel(
  vendorName: string | null,
  routingStatus: string | null,
  fulfillmentStatus: string | null,
  orderStatus?: string,
  isMultiVendor: boolean = false
): string {
  if (orderStatus !== undefined) {
    return customerOrderTimelineParentLabel(orderStatus as ParentOrderStatus, isMultiVendor);
  }
  const r = routingStatus ?? "";
  const f = fulfillmentStatus ?? "";
  const isManuallyRecovered =
    r === "failed" && ["accepted", "preparing", "ready", "completed"].includes(f);
  const part = vendorStatusLabel(r, f, isManuallyRecovered);
  return vendorName ? `${vendorName} — ${part}` : part;
}

export type TimelineEvent = {
  createdAt: Date;
  label: string;
};

type InternalTimelineEvent = TimelineEvent & { type: "order" | "vendor" };

export function buildTimelineEvents(order: {
  statusHistory: Array<{ status: string; createdAt: Date }>;
  vendorOrders: Array<{
    vendor: { name: string };
    statusHistory: Array<{
      routingStatus: string | null;
      fulfillmentStatus: string | null;
      createdAt: Date;
    }>;
  }>;
  refundAttempts?: Array<{ status: string; amountCents: number; createdAt: Date }>;
  orderRefunds?: Array<{ status: string; amountCents: number; createdAt: Date }>;
}): TimelineEvent[] {
  const isMultiVendor = order.vendorOrders.length > 1;
  const raw: InternalTimelineEvent[] = [];

  for (const e of order.statusHistory) {
    raw.push({
      createdAt: e.createdAt,
      label: timelineEntryLabel(null, null, null, e.status, isMultiVendor),
      type: "order",
    });
  }
  const latestLedger = order.orderRefunds?.[0];
  const latestAttempt = order.refundAttempts?.[0];
  const refundForTimeline =
    latestLedger &&
    (latestLedger.status === "succeeded" ||
      !latestAttempt ||
      latestLedger.createdAt >= latestAttempt.createdAt)
      ? latestLedger
      : latestAttempt?.status === "succeeded"
        ? latestAttempt
        : latestLedger ?? latestAttempt;
  if (refundForTimeline?.status === "succeeded") {
    raw.push({
      createdAt: refundForTimeline.createdAt,
      label: `Refund of $${(refundForTimeline.amountCents / 100).toFixed(2)} issued`,
      type: "order",
    });
  }
  for (const vo of order.vendorOrders) {
    for (const e of vo.statusHistory) {
      const label = timelineEntryLabel(
        vo.vendor.name,
        e.routingStatus,
        e.fulfillmentStatus,
        undefined,
        isMultiVendor
      );
      if (label.endsWith(" — Confirmed")) continue;
      raw.push({ createdAt: e.createdAt, label, type: "vendor" });
    }
  }
  raw.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const filtered: TimelineEvent[] = [];
  const orderLabelsSeen = new Set<string>();
  const vendorLabelsSeen = new Set<string>();
  for (const evt of raw) {
    if (evt.type === "order") {
      if (evt.label === "In progress") continue;
      if (orderLabelsSeen.has(evt.label)) continue;
      orderLabelsSeen.add(evt.label);
    } else {
      if (evt.label.endsWith(" — Received")) continue;
      if (vendorLabelsSeen.has(evt.label)) continue;
      vendorLabelsSeen.add(evt.label);
    }
    filtered.push({ createdAt: evt.createdAt, label: evt.label });
  }
  return filtered;
}

export function refundDisplayMessage(order: {
  refundAttempts?: Array<{ status: string; amountCents: number; createdAt: Date }>;
  orderRefunds?: Array<{ status: string; amountCents: number; createdAt: Date }>;
  totalCents?: number;
  totalRefundedCents?: number;
}): { line: string; timelineLabel?: string } | null {
  const latest = pickLatestCustomerRefundDisplay(order);
  const base = customerRefundDisplayMessage(latest);
  if (!base) return null;

  if (
    order.totalCents != null &&
    order.totalRefundedCents != null &&
    isPartialRefundDisplay({
      orderTotalCents: order.totalCents,
      refundedCents: order.totalRefundedCents,
    })
  ) {
    return {
      ...base,
      line: `${base.line} Partial refund applied to your order.`,
    };
  }
  return base;
}

export function customerStatusLabel(
  derivedStatus: string,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>,
  failedButRecoverable: boolean
): string {
  if (failedButRecoverable) return "Confirming your order";
  return customerOrderHeaderStatus(derivedStatus as ParentOrderStatus, vendorOrders);
}

export type CustomerOrderStatusPhase =
  | "received"
  | "scheduled"
  | "in_progress"
  | "partially_ready"
  | "ready"
  | "completed"
  | "cancelled"
  | "needs_attention";

export type CustomerOrderStatusCardCopy = {
  phase: CustomerOrderStatusPhase;
  /** Short chip-style label for the progress section */
  shortLabel: string;
  headline: string;
  nextAction: string;
};

function countReadyOrPickedUp(
  vendorOrders: Array<{ fulfillmentStatus: string }>
): { readyOrPickedUp: number; active: number } {
  const activeOrders = vendorOrders.filter((v) => v.fulfillmentStatus !== "cancelled");
  const readyOrPickedUp = activeOrders.filter((v) =>
    ["ready", "completed"].includes(v.fulfillmentStatus)
  ).length;
  return { readyOrPickedUp, active: activeOrders.length };
}

function isPartiallyReadyOrder(
  derivedStatus: string,
  vendorOrders: Array<{ fulfillmentStatus: string }>
): boolean {
  if (vendorOrders.length <= 1) return false;
  if (["completed", "cancelled", "ready"].includes(derivedStatus)) return false;
  const { readyOrPickedUp, active } = countReadyOrPickedUp(vendorOrders);
  return active > 0 && readyOrPickedUp > 0 && readyOrPickedUp < active;
}

/** UI-only phase for the top customer status card (does not change stored order status). */
export function resolveCustomerOrderStatusPhase(params: {
  derivedStatus: string;
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>;
  failedButRecoverable: boolean;
  requestedPickupAt: unknown;
}): CustomerOrderStatusPhase {
  const { derivedStatus, vendorOrders, failedButRecoverable, requestedPickupAt } = params;

  if (derivedStatus === "cancelled") return "cancelled";
  if (derivedStatus === "completed") return "completed";
  if (derivedStatus === "failed") {
    return failedButRecoverable ? "received" : "needs_attention";
  }
  if (derivedStatus === "ready") return "ready";
  if (isPartiallyReadyOrder(derivedStatus, vendorOrders)) return "partially_ready";
  if (derivedStatus === "partially_completed") return "partially_ready";

  const maxRank = maxParentFulfillmentStepRank(vendorOrders);
  const scheduledPreKitchen =
    requestedPickupAt != null &&
    shouldShowScheduledPickupCustomerLabels(requestedPickupAt, vendorOrders) &&
    (derivedStatus === "in_progress" ||
      derivedStatus === "accepted" ||
      derivedStatus === "preparing") &&
    maxRank < 2;
  if (scheduledPreKitchen) return "scheduled";

  if (
    derivedStatus === "in_progress" ||
    derivedStatus === "accepted" ||
    derivedStatus === "preparing"
  ) {
    return "in_progress";
  }

  return "received";
}

const STATUS_CARD_COPY: Record<
  CustomerOrderStatusPhase,
  Pick<CustomerOrderStatusCardCopy, "shortLabel" | "headline" | "nextAction">
> = {
  received: {
    shortLabel: "Order received",
    headline: "We received your order",
    nextAction: "Vendors are confirming it now.",
  },
  scheduled: {
    shortLabel: "Scheduled",
    headline: "Your pickup is scheduled",
    nextAction: "Vendors will confirm before your pickup time.",
  },
  in_progress: {
    shortLabel: "Preparing",
    headline: "Your order is being prepared",
    nextAction: "We'll text you when each pickup is ready.",
  },
  partially_ready: {
    shortLabel: "Partially ready",
    headline: "Some items are ready",
    nextAction: "Check each vendor below before picking up.",
  },
  ready: {
    shortLabel: "Ready for pickup",
    headline: "Ready for pickup",
    nextAction: "Show your pickup code to each vendor.",
  },
  completed: {
    shortLabel: "Completed",
    headline: "Order completed",
    nextAction: "All vendors are ready or picked up.",
  },
  cancelled: {
    shortLabel: "Cancelled",
    headline: "Order cancelled",
    nextAction: "No further pickup is needed.",
  },
  needs_attention: {
    shortLabel: "Needs attention",
    headline: "Something needs attention",
    nextAction: "Check the vendor details below.",
  },
};

/** Headline + next-action copy for the top order status card on the customer order page. */
export function customerOrderStatusCardCopy(params: {
  derivedStatus: string;
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>;
  failedButRecoverable: boolean;
  requestedPickupAt: unknown;
  pickupDisplay?: OrderPickupDisplayInput;
}): CustomerOrderStatusCardCopy {
  const phase = resolveCustomerOrderStatusPhase(params);
  const copy = STATUS_CARD_COPY[phase];
  let nextAction = copy.nextAction;

  if (phase === "scheduled" && params.pickupDisplay) {
    const scheduledLead = formatPickupSummaryScheduledLead(params.pickupDisplay);
    if (scheduledLead) {
      nextAction = scheduledLead;
    }
  }

  if (phase === "received" && params.vendorOrders.length === 1) {
    nextAction = "The restaurant is confirming your order now.";
  }

  return { phase, ...copy, nextAction };
}
