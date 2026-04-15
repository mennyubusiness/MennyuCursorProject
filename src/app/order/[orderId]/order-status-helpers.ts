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
  requestedPickupAt?: unknown
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
    return `Your pickup is scheduled. ${orderStageLineFromMinRank(minRank, multi)}`;
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
  const part = vendorStatusLabel(r, f, false);
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
  const latestRefund = order.refundAttempts?.[0];
  if (latestRefund?.status === "succeeded") {
    raw.push({
      createdAt: latestRefund.createdAt,
      label: `Refund of $${(latestRefund.amountCents / 100).toFixed(2)} issued`,
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
  for (const evt of raw) {
    if (evt.type === "order") {
      if (evt.label === "In progress") continue;
      if (orderLabelsSeen.has(evt.label)) continue;
      orderLabelsSeen.add(evt.label);
    }
    filtered.push({ createdAt: evt.createdAt, label: evt.label });
  }
  return filtered;
}

export function formatTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function refundDisplayMessage(
  latestAttempt: { status: string; amountCents: number; createdAt: Date } | null | undefined
): { line: string; timelineLabel?: string } | null {
  if (!latestAttempt) return null;
  const amountFormatted = `$${(latestAttempt.amountCents / 100).toFixed(2)}`;
  if (latestAttempt.status === "succeeded") {
    return {
      line: `Refunded. Refund of ${amountFormatted} issued.`,
      timelineLabel: `Refund of ${amountFormatted} issued`,
    };
  }
  if (latestAttempt.status === "attempted") return { line: "Refund pending.", timelineLabel: undefined };
  if (latestAttempt.status === "failed") return { line: "Refund issue — under review.", timelineLabel: undefined };
  return null;
}

export function customerStatusLabel(
  derivedStatus: string,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>,
  failedButRecoverable: boolean
): string {
  if (failedButRecoverable) return "Confirming your order";
  return customerOrderHeaderStatus(derivedStatus as ParentOrderStatus, vendorOrders);
}
