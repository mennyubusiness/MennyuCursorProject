/**
 * Deliverect vs Open Order authority for vendor-order kitchen status.
 * Channel-linked orders are POS-managed unless admin manual recovery took control.
 * Vendor orderRoutingMode is the primary gate: manual_dashboard vendors always manage fulfillment in Open Order.
 */
import {
  getEffectiveAuthority,
  type VendorOrderAuthoritySnapshot,
} from "@/domain/status-authority";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { isDeliverectRoutingMode, isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export const VENDOR_DELIVERECT_CONTROLLED_MESSAGE =
  "This order is controlled by Deliverect/POS. Status updates must come from the POS.";

export const VENDOR_DELIVERECT_CONTROLLED_NOTICE =
  "Status is controlled by your POS through Deliverect. Open Order will update automatically when the POS sends updates.";

export function hasDeliverectChannelLink(
  vo: Pick<VendorOrderAuthoritySnapshot, "deliverectChannelLinkId" | "vendor">
): boolean {
  const ch = vo.deliverectChannelLinkId ?? vo.vendor?.deliverectChannelLinkId;
  return Boolean(ch != null && String(ch).trim() !== "");
}

/**
 * Kitchen status should come from Deliverect/POS webhooks, not the vendor dashboard.
 * Manual dashboard vendors are never POS-authoritative regardless of channel link.
 */
export function isDeliverectAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot,
  orderRoutingMode?: VendorOrderRoutingMode | string | null
): boolean {
  if (orderRoutingMode === "manual_dashboard") return false;
  if (isSquareRoutingMode(orderRoutingMode)) return false;
  if (vo.manuallyRecoveredAt != null) return false;
  if (getEffectiveAuthority(vo) === "admin_override") return false;
  return hasDeliverectChannelLink(vo);
}

/** Open Order (or admin recovery) may drive status from the vendor dashboard. */
export function isOpenOrderAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot,
  orderRoutingMode?: VendorOrderRoutingMode | string | null
): boolean {
  return !isDeliverectAuthoritativeVendorOrder(vo, orderRoutingMode);
}

export const VENDOR_SQUARE_SYNC_NOTICE =
  "This order is routed to Square. Status updates from Square will update Open Order.";

export function isSquareRoutedVendorOrderWithSync(input: {
  squareOrderId?: string | null;
  orderRoutingMode?: VendorOrderRoutingMode | string | null;
}): boolean {
  return isSquareRoutingMode(input.orderRoutingMode) && Boolean(input.squareOrderId?.trim());
}

export function canVendorDashboardMutateVendorOrder(
  vo: VendorOrderAuthoritySnapshot,
  orderRoutingMode?: VendorOrderRoutingMode | string | null
): boolean {
  if (orderRoutingMode === "manual_dashboard") return true;
  if (isSquareRoutingMode(orderRoutingMode)) return true;
  if (isDeliverectRoutingMode(orderRoutingMode)) {
    return isOpenOrderAuthoritativeVendorOrder(vo, orderRoutingMode);
  }
  return isOpenOrderAuthoritativeVendorOrder(vo);
}
