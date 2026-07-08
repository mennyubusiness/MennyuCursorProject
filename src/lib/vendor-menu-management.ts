import type { VendorOrderRoutingMode } from "@prisma/client";
import { normalizeVendorOrderRoutingMode } from "@/lib/vendor-order-routing-mode";

/** How vendors manage menus in the dashboard (distinct from Vendor.menuSource). */
export type VendorMenuManagementMode = "builder" | "imports";

/**
 * Primary vendor menu UX mode based on order routing — not menuSource alone.
 * manual_dashboard → Open Order Menu Builder
 * deliverect | square → Menu Imports / POS sync
 */
export function getVendorMenuManagementMode(
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): VendorMenuManagementMode {
  const mode = normalizeVendorOrderRoutingMode(orderRoutingMode);
  if (mode === "deliverect" || mode === "square") return "imports";
  return "builder";
}

export function usesVendorMenuBuilder(
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): boolean {
  return getVendorMenuManagementMode(orderRoutingMode) === "builder";
}

export function vendorMenuManagementNavLabel(
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): string {
  return usesVendorMenuBuilder(orderRoutingMode) ? "Menu Builder" : "Menu Imports";
}

export function vendorMenuManagementPath(
  vendorId: string,
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): string {
  return usesVendorMenuBuilder(orderRoutingMode)
    ? `/vendor/${vendorId}/menu-builder`
    : `/vendor/${vendorId}/menu/imports`;
}

export function vendorMenuManagementModeLabel(mode: VendorMenuManagementMode): string {
  return mode === "builder" ? "Builder" : "Imports";
}
