import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";
import {
  openOrderCanonicalMenuSchema,
  type OpenOrderCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import {
  menuSourceProvider,
  type MenuSourceProvider,
} from "@/domain/menu-import/menu-source-provider";
import { isOpenOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { isSquareProductDeliverectId } from "@/lib/integrations/square/square-menu-ids";

export type VendorMenuSourceFields = {
  menuSource: VendorMenuSource;
  orderRoutingMode: VendorOrderRoutingMode;
  deliverectChannelLinkId?: string | null;
};

/** Finer-grained active catalog provider (Square vs native share VendorMenuSource.open_order). */
export type ActiveMenuProvider = Exclude<MenuSourceProvider, "unknown">;

export type ActiveMenuSourceResolution = {
  orderRoutingMode: VendorOrderRoutingMode;
  /** Persisted Vendor.menuSource pointer (may be stale until reconciled). */
  menuSourcePersisted: VendorMenuSource;
  /** Authoritative VendorMenuSource for the current routing mode. */
  menuSource: VendorMenuSource;
  /** Authoritative provider used for MenuVersion / MenuItem filtering. */
  provider: ActiveMenuProvider;
  isAligned: boolean;
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

/**
 * One active menu provider per routing mode.
 * manual_dashboard → open_order builder; deliverect → Deliverect; square → Square catalog.
 */
export function activeMenuProviderForOrderRoutingMode(
  orderRoutingMode: VendorOrderRoutingMode
): ActiveMenuProvider {
  if (orderRoutingMode === "deliverect") return "deliverect";
  if (orderRoutingMode === "square") return "square";
  return "open_order";
}

/**
 * Central resolution for "which menu is authoritative right now".
 * Routing mode wins for expected source/provider; persisted menuSource may lag until reconcile.
 */
export function resolveActiveMenuSource(
  vendor: Pick<VendorMenuSourceFields, "menuSource" | "orderRoutingMode">
): ActiveMenuSourceResolution {
  const menuSource = menuSourceForOrderRoutingMode(vendor.orderRoutingMode);
  const provider = activeMenuProviderForOrderRoutingMode(vendor.orderRoutingMode);
  return {
    orderRoutingMode: vendor.orderRoutingMode,
    menuSourcePersisted: vendor.menuSource,
    menuSource,
    provider,
    isAligned: vendor.menuSource === menuSource,
  };
}

/** Disambiguate open_order VendorMenuSource into native vs Square using routing mode. */
export function activeMenuProviderFromMenuSourceHint(
  menuSource: VendorMenuSource,
  orderRoutingMode: VendorOrderRoutingMode
): ActiveMenuProvider {
  if (menuSource === "deliverect") return "deliverect";
  if (orderRoutingMode === "square") return "square";
  return "open_order";
}

export function canonicalActiveProviderFromMenu(
  menu: OpenOrderCanonicalMenu
): MenuSourceProvider {
  return menuSourceProvider(menu.deliverect.sourcePayloadKind);
}

export function canonicalActiveProviderFromSnapshot(snapshot: unknown): MenuSourceProvider {
  // Prefer lightweight kind extraction so ownership reconcile works even if snapshots
  // are partially invalid; fall back to full schema parse when needed.
  if (snapshot && typeof snapshot === "object") {
    const kind = (snapshot as { deliverect?: { sourcePayloadKind?: unknown } }).deliverect
      ?.sourcePayloadKind;
    if (typeof kind === "string") {
      const fromKind = menuSourceProvider(kind);
      if (fromKind !== "unknown") return fromKind;
    }
  }
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return "unknown";
  return canonicalActiveProviderFromMenu(parsed.data);
}

export function canonicalMatchesActiveProvider(
  snapshot: unknown,
  provider: ActiveMenuProvider
): boolean {
  return canonicalActiveProviderFromSnapshot(snapshot) === provider;
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

export function canonicalMenuSourceFromMenu(menu: OpenOrderCanonicalMenu): VendorMenuSource {
  const kind = menu.deliverect.sourcePayloadKind;
  if (kind === "open_order_builder_v1" || kind === "square_catalog_v1") {
    return "open_order";
  }
  return "deliverect";
}

export function canonicalMenuSourceFromSnapshot(snapshot: unknown): VendorMenuSource | null {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
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

/** Provider-strict item match — does not treat Square and native Open Order as interchangeable. */
export function menuItemMatchesActiveProvider(
  deliverectProductId: string | null | undefined,
  provider: ActiveMenuProvider
): boolean {
  if (!deliverectProductId) return false;
  const isOpenOrder = isOpenOrderProductDeliverectId(deliverectProductId);
  const isSquare = isSquareProductDeliverectId(deliverectProductId);
  if (provider === "open_order") return isOpenOrder;
  if (provider === "square") return isSquare;
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
