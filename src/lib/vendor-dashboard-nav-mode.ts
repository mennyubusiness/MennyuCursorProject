/**
 * Which vendor dashboard surfaces make sense for a menu-only vendor.
 *
 * Menu-only hides commerce operations rather than disabling them, but never hides work the
 * vendor still owes a customer: an in-flight ticket keeps the kitchen and orders surfaces, and
 * past orders stay reachable so history and refunds are never stranded.
 */
export type VendorDashboardNavMode = {
  /** Effective ordering intent is off (pod-wide or vendor-level). */
  menuOnly: boolean;
  /** An order is still new/preparing/ready and must be finished. */
  hasActiveOrders: boolean;
  /** The vendor has at least one order ever. */
  hasOrderHistory: boolean;
};

export const DEFAULT_VENDOR_DASHBOARD_NAV_MODE: VendorDashboardNavMode = {
  menuOnly: false,
  hasActiveOrders: false,
  hasOrderHistory: false,
};

/** Nav hrefs that only exist to run commerce, and go away in menu-only mode. */
const MENU_ONLY_HIDDEN_NAV_HREFS = new Set(["payouts"]);

export function isVendorNavHrefVisible(href: string, mode: VendorDashboardNavMode): boolean {
  if (!mode.menuOnly) return true;
  if (MENU_ONLY_HIDDEN_NAV_HREFS.has(href)) return false;
  if (href === "orders") return mode.hasActiveOrders || mode.hasOrderHistory;
  return true;
}

/** Kitchen is order-operations only: keep it exactly as long as there is a ticket to finish. */
export function vendorNavShowsKitchen(mode: VendorDashboardNavMode): boolean {
  return !mode.menuOnly || mode.hasActiveOrders;
}

/** Commerce prerequisites (Stripe, routing, POS) are only asked for when ordering is intended. */
export function vendorShowsCommerceSetup(mode: VendorDashboardNavMode): boolean {
  return !mode.menuOnly;
}
