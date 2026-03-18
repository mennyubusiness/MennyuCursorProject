/**
 * Shared pure helpers for customer order status display (server and client).
 */
import {
  customerOrderHeaderStatus,
  customerOrderTimelineParentLabel,
} from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";

export function vendorStatusLabel(
  routingStatus: string,
  fulfillmentStatus: string,
  isManuallyRecovered?: boolean
): string {
  if (routingStatus === "failed" && !isManuallyRecovered) return "Unavailable";
  const fulfillmentLabels: Record<string, string> = {
    pending: "Order received",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Picked up",
    cancelled: "Cancelled",
  };
  const label = fulfillmentLabels[fulfillmentStatus];
  if (label) return label;
  if (routingStatus === "sent" || routingStatus === "confirmed") return "Order received";
  return "In progress";
}

export function orderSummaryExplanation(
  derivedStatus: string,
  vendorOrders: Array<{ fulfillmentStatus: string; routingStatus: string }>
): string {
  const ready = vendorOrders.filter((v) => v.fulfillmentStatus === "ready").length;
  const preparing = vendorOrders.filter((v) =>
    ["accepted", "preparing"].includes(v.fulfillmentStatus)
  ).length;
  const completed = vendorOrders.filter((v) => v.fulfillmentStatus === "completed").length;
  const total = vendorOrders.length;

  if (derivedStatus === "completed") {
    return "Your order is complete. Thank you!";
  }
  if (derivedStatus === "ready") {
    if (total === 1) return "Your order is ready for pickup.";
    return "Your order is ready for pickup.";
  }
  if (derivedStatus === "in_progress") {
    if (ready > 0 && preparing > 0) {
      return `${ready} ${ready === 1 ? "vendor has" : "vendors have"} your items ready; ${preparing} ${preparing === 1 ? "is" : "are"} still preparing.`;
    }
    if (ready > 0) return "Your items are ready for pickup.";
    return "We're preparing your order with our vendors.";
  }
  if (derivedStatus === "partially_completed") {
    return "Part of your order is complete; we'll update you on the rest.";
  }
  if (derivedStatus === "routing") {
    return total > 1
      ? "Each vendor is getting your order. You'll see updates as they accept."
      : "Your vendor is receiving your order.";
  }
  if (derivedStatus === "routed_partial" && total > 1) {
    const confirmed = vendorOrders.filter((v) => v.routingStatus === "confirmed").length;
    if (confirmed > 0 && confirmed < total)
      return "Some vendors have already accepted; we're waiting on the others.";
    return "We're waiting on each vendor to confirm your order.";
  }
  if (derivedStatus === "routed" || derivedStatus === "routed_partial") {
    return "You'll get updates as soon as your vendor accepts.";
  }
  if (derivedStatus === "paid" || derivedStatus === "pending_payment") {
    return "We're getting your order to the vendors.";
  }
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
  if (derivedStatus === "cancelled") return "This order was cancelled.";
  return "We'll send updates to your phone as things progress.";
}

export function timelineEntryLabel(
  vendorName: string | null,
  routingStatus: string | null,
  fulfillmentStatus: string | null,
  orderStatus?: string
): string {
  if (orderStatus !== undefined) {
    return customerOrderTimelineParentLabel(orderStatus as ParentOrderStatus);
  }
  const fulfillmentLabels: Record<string, string> = {
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const routingLabels: Record<string, string> = {
    sent: "Received your order",
    confirmed: "Confirmed",
    failed: "Unavailable",
  };
  const part =
    (fulfillmentStatus && fulfillmentLabels[fulfillmentStatus]) ??
    (routingStatus && routingLabels[routingStatus]) ??
    "Updated";
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
  const raw: InternalTimelineEvent[] = [];

  for (const e of order.statusHistory) {
    raw.push({
      createdAt: e.createdAt,
      label: timelineEntryLabel(null, null, null, e.status),
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
        e.fulfillmentStatus
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
