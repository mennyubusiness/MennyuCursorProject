import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";

export type VendorMenuSourceFields = {
  menuSource: VendorMenuSource;
  orderRoutingMode: VendorOrderRoutingMode;
  deliverectChannelLinkId?: string | null;
};

export function isOpenOrderMenuSource(vendor: Pick<VendorMenuSourceFields, "menuSource">): boolean {
  return vendor.menuSource === "open_order";
}

export function isDeliverectMenuSource(vendor: Pick<VendorMenuSourceFields, "menuSource">): boolean {
  return vendor.menuSource === "deliverect";
}

/** Predictable menu source when admin changes order routing mode. */
export function menuSourceForOrderRoutingMode(
  orderRoutingMode: VendorOrderRoutingMode
): VendorMenuSource {
  return orderRoutingMode === "deliverect" ? "deliverect" : "open_order";
}

export function vendorMenuSourceLabel(menuSource: VendorMenuSource): string {
  return menuSource === "open_order" ? "Open Order Menu Builder" : "Deliverect menu sync";
}

export function vendorMenuSourceNavLabel(menuSource: VendorMenuSource): string {
  return menuSource === "open_order" ? "Menu Builder" : "POS Menu Sync";
}

export function vendorMenuSourceVendorPath(vendorId: string, menuSource: VendorMenuSource): string {
  return menuSource === "open_order"
    ? `/vendor/${vendorId}/menu-builder`
    : `/vendor/${vendorId}/menu`;
}

export function vendorUsesMenuBuilder(menuSource: VendorMenuSource): boolean {
  return menuSource === "open_order";
}

export type VendorMenuSourceMismatch = {
  headline: string;
  detail: string;
};

/** Warn when routing and menu tooling diverge — do not silently assume either field. */
export function getVendorMenuSourceMismatchWarning(
  vendor: VendorMenuSourceFields
): VendorMenuSourceMismatch | null {
  const expectedFromRouting = menuSourceForOrderRoutingMode(vendor.orderRoutingMode);
  if (vendor.menuSource === expectedFromRouting) return null;

  if (vendor.orderRoutingMode === "manual_dashboard" && vendor.menuSource === "deliverect") {
    return {
      headline: "Menu source mismatch",
      detail:
        "This vendor routes orders manually but uses a Deliverect menu source. Vendors see Deliverect menu sync, not the Open Order Menu Builder.",
    };
  }

  if (vendor.orderRoutingMode === "deliverect" && vendor.menuSource === "open_order") {
    return {
      headline: "Menu source mismatch",
      detail:
        "This vendor routes orders through Deliverect but uses the Open Order Menu Builder for menus. Confirm this is intentional before launch.",
    };
  }

  return {
    headline: "Menu source mismatch",
    detail: `Routing mode is ${vendor.orderRoutingMode} but menu source is ${vendor.menuSource}.`,
  };
}
