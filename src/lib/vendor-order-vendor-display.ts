/**
 * Plain-English order labels for vendor-facing UI.
 * Maps internal routing/fulfillment values without exposing raw backend terms.
 */

export type VendorOrderHistoryEntry = {
  routingStatus?: string | null;
  fulfillmentStatus?: string | null;
  source?: string | null;
  createdAt: string;
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
  fulfillmentStatus: string
): string {
  if (routingStatus === "failed" && fulfillmentStatus === "pending") {
    return "Could not send to POS";
  }
  switch (routingStatus) {
    case "pending":
      return "Waiting to send to POS";
    case "sent":
      return "Sent to POS";
    case "confirmed":
      return "Accepted by POS";
    case "failed":
      return "Could not send to POS";
    default:
      return "Orders are routing correctly";
  }
}

/** Combined headline status for vendor order detail. */
export function vendorOrderHeadlineStatus(input: {
  routingStatus: string;
  fulfillmentStatus: string;
  needsAttention?: boolean;
}): string {
  if (input.needsAttention) return "Needs attention";
  if (input.routingStatus === "failed" && input.fulfillmentStatus === "pending") {
    return "Could not send to POS";
  }
  if (input.fulfillmentStatus === "ready") return "Ready for pickup";
  if (input.fulfillmentStatus === "preparing") return "Preparing";
  if (input.fulfillmentStatus === "accepted") return "Accepted by POS";
  if (input.fulfillmentStatus === "completed") return "Completed";
  if (input.fulfillmentStatus === "cancelled") return "Cancelled";
  if (input.routingStatus === "sent") return "Sent to POS";
  if (input.routingStatus === "confirmed") return "Accepted by POS";
  if (input.routingStatus === "pending" && input.fulfillmentStatus === "pending") {
    return "Waiting for POS confirmation";
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
