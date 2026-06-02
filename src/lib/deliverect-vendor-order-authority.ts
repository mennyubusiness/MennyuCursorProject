/**
 * Deliverect vs Open Order authority for vendor-order kitchen status.
 * Channel-linked orders are POS-managed unless admin manual recovery took control.
 */
import {
  getEffectiveAuthority,
  type VendorOrderAuthoritySnapshot,
} from "@/domain/status-authority";

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
 */
export function isDeliverectAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot
): boolean {
  if (vo.manuallyRecoveredAt != null) return false;
  if (getEffectiveAuthority(vo) === "admin_override") return false;
  return hasDeliverectChannelLink(vo);
}

/** Open Order (or admin recovery) may drive status from the vendor dashboard. */
export function isOpenOrderAuthoritativeVendorOrder(
  vo: VendorOrderAuthoritySnapshot
): boolean {
  return !isDeliverectAuthoritativeVendorOrder(vo);
}

export function canVendorDashboardMutateVendorOrder(
  vo: VendorOrderAuthoritySnapshot
): boolean {
  return isOpenOrderAuthoritativeVendorOrder(vo);
}
