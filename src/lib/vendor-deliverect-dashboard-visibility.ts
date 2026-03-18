/**
 * When to omit Deliverect-integrated vendor orders from the vendor dashboard vs show degraded fallback.
 * Healthy path: submit runs soon after payment → sent/confirmed → vendor sees Accept/Deny.
 * While still within the grace window after order update (payment), hide pending/pending so we don’t
 * show “POS didn’t sync” before routing has had a fair chance to complete.
 */

/** After this many ms since parent order was last updated, still-pending routing is treated as stuck / degraded. */
export const DELIVERECT_VENDOR_DASHBOARD_ROUTING_GRACE_MS = 120_000; // 2 minutes

export type VoForDeliverectDashboardVisibility = {
  routingStatus: string;
  fulfillmentStatus: string;
  deliverectAttempts: number;
  order: { updatedAt: Date | string };
};

export type VendorForDeliverectDashboardVisibility = {
  deliverectChannelLinkId: string | null;
};

/**
 * Omit from vendor list: live Deliverect vendor, VO still pending/pending, no submission attempt yet,
 * and parent order was recently updated (e.g. just paid). Once grace passes or any attempt was made, show the row.
 */
export function shouldOmitVendorOrderFromDeliverectDashboard(
  vo: VoForDeliverectDashboardVisibility,
  vendor: VendorForDeliverectDashboardVisibility,
  isDeliverectLive: boolean,
  nowMs: number
): boolean {
  if (!isDeliverectLive || !String(vendor.deliverectChannelLinkId ?? "").trim()) {
    return false;
  }
  if (vo.routingStatus !== "pending" || vo.fulfillmentStatus !== "pending") {
    return false;
  }
  if (vo.deliverectAttempts > 0) {
    return false;
  }
  const orderUpdated = new Date(vo.order.updatedAt).getTime();
  if (!Number.isFinite(orderUpdated)) return false;
  return nowMs - orderUpdated < DELIVERECT_VENDOR_DASHBOARD_ROUTING_GRACE_MS;
}

/**
 * True when live Deliverect VO is pending/pending beyond healthy wait — show manual confirm / degraded copy.
 */
export function isDeliverectVendorOrderRoutingDegraded(
  vo: VoForDeliverectDashboardVisibility,
  vendor: VendorForDeliverectDashboardVisibility,
  isDeliverectLive: boolean,
  nowMs: number
): boolean {
  if (!isDeliverectLive || !String(vendor.deliverectChannelLinkId ?? "").trim()) {
    return false;
  }
  if (vo.routingStatus !== "pending" || vo.fulfillmentStatus !== "pending") {
    return false;
  }
  return !shouldOmitVendorOrderFromDeliverectDashboard(vo, vendor, isDeliverectLive, nowMs);
}
