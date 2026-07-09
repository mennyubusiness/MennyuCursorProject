/**
 * Plain-English order labels for vendor-facing UI.
 * Maps internal routing/fulfillment values without exposing raw backend terms.
 */

import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export type VendorOrderHistoryEntry = {
  routingStatus?: string | null;
  fulfillmentStatus?: string | null;
  source?: string | null;
  createdAt: string;
};

export type VendorRoutingDisplayContext = {
  orderRoutingMode?: string | null;
};

export function vendorFulfillmentStatusLabel(fulfillmentStatus: string): string {
  switch (fulfillmentStatus) {
    case "pending":
      return "New order";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready for pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "In progress";
  }
}

export function vendorRoutingStatusLabel(
  routingStatus: string,
  fulfillmentStatus: string,
  context?: VendorRoutingDisplayContext
): string {
  const squareMode = isSquareRoutingMode(context?.orderRoutingMode);

  if (routingStatus === "failed" && fulfillmentStatus === "pending") {
    return squareMode
      ? "Square routing failed — Open Order still has the paid order"
      : "Could not send to POS";
  }

  switch (routingStatus) {
    case "pending":
      return squareMode ? "Sending to Square" : "Waiting to send to POS";
    case "sent":
      return squareMode ? "Sent to Square" : "Sent to POS";
    case "confirmed":
      return squareMode ? "Accepted in Square" : "Accepted by POS";
    case "failed":
      return squareMode
        ? "Square routing failed — Open Order still has the paid order"
        : "Could not send to POS";
    default:
      return "Orders are routing correctly";
  }
}

/** Combined headline status for vendor order detail. */
export function vendorOrderHeadlineStatus(input: {
  routingStatus: string;
  fulfillmentStatus: string;
  needsAttention?: boolean;
  orderRoutingMode?: string | null;
}): string {
  const squareMode = isSquareRoutingMode(input.orderRoutingMode);

  if (input.needsAttention) return "Needs attention";
  if (input.routingStatus === "failed" && input.fulfillmentStatus === "pending") {
    return squareMode
      ? "Square routing failed — Open Order still has the paid order"
      : "Could not send to POS";
  }
  if (input.fulfillmentStatus === "ready") return "Ready for pickup";
  if (input.fulfillmentStatus === "preparing") return "Preparing";
  if (input.fulfillmentStatus === "accepted") {
    return squareMode ? "Accepted in Square" : "Accepted by POS";
  }
  if (input.fulfillmentStatus === "completed") return "Completed";
  if (input.fulfillmentStatus === "cancelled") return "Cancelled";
  if (input.routingStatus === "sent") return squareMode ? "Sent to Square" : "Sent to POS";
  if (input.routingStatus === "confirmed") {
    return squareMode ? "Accepted in Square" : "Accepted by POS";
  }
  if (input.routingStatus === "pending" && input.fulfillmentStatus === "pending") {
    return squareMode ? "Sending to Square" : "Waiting for POS confirmation";
  }
  return vendorFulfillmentStatusLabel(input.fulfillmentStatus);
}

export function vendorOrderTimelineLabel(entry: VendorOrderHistoryEntry): string {
  const fulfillment = entry.fulfillmentStatus?.trim();
  const routing = entry.routingStatus?.trim();
  if (fulfillment) {
    return vendorFulfillmentStatusLabel(fulfillment);
  }
  if (routing) {
    return vendorRoutingStatusLabel(routing, fulfillment ?? "pending");
  }
  if (entry.source === "deliverect") return "Updated from POS";
  if (entry.source === "vendor") return "Updated in Open Order";
  if (entry.source === "admin") return "Updated by support";
  return "Status updated";
}

export function formatVendorOrderTimelineTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
