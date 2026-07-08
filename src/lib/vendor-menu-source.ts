import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import { isOpenOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { isSquareProductDeliverectId } from "@/lib/integrations/square/square-menu-ids";

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
  if (orderRoutingMode === "deliverect") return "deliverect";
  return "open_order";
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

export function canonicalMenuSourceFromMenu(menu: MennyuCanonicalMenu): VendorMenuSource {
  const kind = menu.deliverect.sourcePayloadKind;
  if (kind === "open_order_builder_v1" || kind === "square_catalog_v1") {
    return "open_order";
  }
  return "deliverect";
}

export function canonicalMenuSourceFromSnapshot(snapshot: unknown): VendorMenuSource | null {
  const parsed = mennyuCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  return canonicalMenuSourceFromMenu(parsed.data);
}

export function canonicalMatchesMenuSource(
  snapshot: unknown,
  menuSource: VendorMenuSource
): boolean {
  return canonicalMenuSourceFromSnapshot(snapshot) === menuSource;
}

export function menuItemDeliverectIdMatchesMenuSource(
  deliverectProductId: string | null | undefined,
  menuSource: VendorMenuSource
): boolean {
  if (!deliverectProductId) return false;
  const isOpenOrder = isOpenOrderProductDeliverectId(deliverectProductId);
  const isSquare = isSquareProductDeliverectId(deliverectProductId);
  if (menuSource === "open_order") {
    return isOpenOrder || isSquare;
  }
  return !isOpenOrder && !isSquare;
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

  if (vendor.orderRoutingMode === "square" && vendor.menuSource === "deliverect") {
    return {
      headline: "Menu source mismatch",
      detail:
        "This vendor routes orders through Square but uses Deliverect menu sync. Confirm this is intentional before launch.",
    };
  }

  return {
    headline: "Menu source mismatch",
    detail: `Routing mode is ${vendor.orderRoutingMode} but menu source is ${vendor.menuSource}.`,
  };
}
