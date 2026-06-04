/** Privacy-safe customer phone display for vendor-facing UIs. */
export function formatVendorCustomerPhone(phone: string | null): string | null {
  if (!phone || !phone.trim()) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone.trim();
}

/**
 * Next manual dashboard action for a vendor order.
 * Returns null when POS is authoritative or no transition applies.
 */
export function getVendorOrderNextAction(
  routingStatus: string,
  fulfillmentStatus: string,
  isDeliverectLive: boolean
): { targetState: string; label: string } | null {
  if (fulfillmentStatus === "pending") {
    if (routingStatus === "sent" || routingStatus === "confirmed") {
      return { targetState: "accepted", label: "Accept order" };
    }
    if (routingStatus === "pending" && !isDeliverectLive) {
      return { targetState: "confirmed", label: "Confirm order" };
    }
  }
  if (fulfillmentStatus === "accepted") {
    return { targetState: "preparing", label: "Start preparing" };
  }
  if (fulfillmentStatus === "preparing") {
    return { targetState: "ready", label: "Mark ready" };
  }
  if (fulfillmentStatus === "ready") {
    return { targetState: "completed", label: "Mark completed" };
  }
  return null;
}

/** Kitchen-friendly labels for the same transitions. */
export function getVendorOrderKitchenActionLabel(
  routingStatus: string,
  fulfillmentStatus: string,
  isDeliverectLive: boolean
): { targetState: string; label: string } | null {
  const action = getVendorOrderNextAction(routingStatus, fulfillmentStatus, isDeliverectLive);
  if (!action) return null;
  const kitchenLabels: Record<string, string> = {
    confirmed: "Confirm",
    accepted: "Accept",
    preparing: "Start preparing",
    ready: "Mark ready",
    completed: "Picked up",
  };
  return {
    targetState: action.targetState,
    label: kitchenLabels[action.targetState] ?? action.label,
  };
}
