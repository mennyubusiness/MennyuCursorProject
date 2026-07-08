import type { MenuImportSource, VendorOrderRoutingMode } from "@prisma/client";
import type { VendorPosUiState } from "@/lib/vendor-pos-ui-state";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
} from "@/lib/vendor-order-routing-mode";

export type ProviderRoutingKey = VendorOrderRoutingMode;

export type ProviderDisplayProfile = {
  displayName: string;
  shortName: string;
  routingDescription: string;
  menuImportLabel: string | null;
  catalogLabel: string | null;
  connectedLabel: string;
  menuImportsSectionTitle: string;
};

const MANUAL_PROFILE: ProviderDisplayProfile = {
  displayName: "Open Order Dashboard",
  shortName: "Dashboard",
  routingDescription: "Orders appear in the Open Order vendor dashboard.",
  menuImportLabel: null,
  catalogLabel: "Open Order menu builder",
  connectedLabel: "Open Order dashboard routing",
  menuImportsSectionTitle: "Menu imports",
};

const DELIVERECT_PROFILE: ProviderDisplayProfile = {
  displayName: "Deliverect",
  shortName: "Deliverect",
  routingDescription: "Orders are sent to Deliverect for POS/kitchen routing where supported.",
  menuImportLabel: "Deliverect menu import",
  catalogLabel: "Deliverect menu",
  connectedLabel: "Deliverect / POS-connected routing",
  menuImportsSectionTitle: "Menu imports",
};

const SQUARE_PROFILE: ProviderDisplayProfile = {
  displayName: "Square",
  shortName: "Square",
  routingDescription:
    "Paid Open Order orders are sent to Square as prepaid pickup orders when injection is enabled.",
  menuImportLabel: "Square catalog import",
  catalogLabel: "Square catalog",
  connectedLabel: "Square / POS-connected routing",
  menuImportsSectionTitle: "Menu imports",
};

const TOAST_PLACEHOLDER_PROFILE: ProviderDisplayProfile = {
  displayName: "Toast",
  shortName: "Toast",
  routingDescription: "Toast POS routing is not available yet.",
  menuImportLabel: null,
  catalogLabel: null,
  connectedLabel: "Toast routing (coming soon)",
  menuImportsSectionTitle: "Menu imports",
};

const PROFILES: Record<ProviderRoutingKey, ProviderDisplayProfile> = {
  manual_dashboard: MANUAL_PROFILE,
  deliverect: DELIVERECT_PROFILE,
  square: SQUARE_PROFILE,
};

export function normalizeProviderRoutingKey(
  mode: VendorOrderRoutingMode | string | null | undefined
): ProviderRoutingKey {
  if (mode === "deliverect") return "deliverect";
  if (mode === "square") return "square";
  return "manual_dashboard";
}

export function getProviderDisplayProfile(
  mode: VendorOrderRoutingMode | string | null | undefined
): ProviderDisplayProfile {
  return PROFILES[normalizeProviderRoutingKey(mode)];
}

/** @deprecated Prefer getProviderDisplayProfile — kept for route labels. */
export function integratedOrderRoutingLabel(
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): string {
  return getProviderDisplayProfile(orderRoutingMode).shortName;
}

export function vendorMenuImportsPageSubtitle(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  if (isSquareRoutingMode(mode)) {
    return "Review imported menus, publish menu updates, and manage your import history.";
  }
  if (isDeliverectRoutingMode(mode)) {
    return "Review Deliverect menu imports, publish menu updates, and manage your import history.";
  }
  return "Manage draft menus and published menu snapshots.";
}

export function vendorMenuManagementPageSubtitle(
  mode: VendorOrderRoutingMode | string | null | undefined,
  vendorName: string
): string {
  if (isSquareRoutingMode(mode)) {
    return `Review imported menus, publish menu updates, and manage published menu snapshots for ${vendorName}.`;
  }
  if (isDeliverectRoutingMode(mode)) {
    return `Review Deliverect menu imports, publish menu updates, and manage published menu snapshots for ${vendorName}.`;
  }
  return `Manage draft menus and published menu snapshots for ${vendorName}.`;
}

export function menuImportDraftReviewBanner(
  source: MenuImportSource | string | null | undefined,
  vendorName: string
): string {
  if (source === "SQUARE_CATALOG_PULL") {
    return `A Square catalog import is waiting for review before it affects the live menu for ${vendorName}.`;
  }
  if (source === "DELIVERECT_MENU_WEBHOOK" || source === "DELIVERECT_API_PULL") {
    return `A Deliverect menu import is waiting for review before it affects the live menu for ${vendorName}.`;
  }
  return `A menu import is waiting for review before it affects the live menu for ${vendorName}.`;
}

export function adminMenuManagementToolDescription(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  if (isSquareRoutingMode(mode)) {
    return "Square catalog imports, publish/discard, snapshots";
  }
  if (isDeliverectRoutingMode(mode)) {
    return "Deliverect imports, publish/discard, snapshots";
  }
  return "Menu builder drafts, publish/discard, snapshots";
}

export function adminPosMappingToolVisible(
  mode: VendorOrderRoutingMode | string | null | undefined
): boolean {
  return isDeliverectRoutingMode(mode);
}

export function adminPosMappingToolTitle(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  return isDeliverectRoutingMode(mode) ? "POS & Deliverect IDs" : "POS mapping";
}

export function adminPosMappingToolDescription(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  return isDeliverectRoutingMode(mode)
    ? "Channel mapping and POS health"
    : "POS mapping (not used for this routing mode)";
}

export function adminSquareInjectionDiagnosticsVisible(
  mode: VendorOrderRoutingMode | string | null | undefined
): boolean {
  return isSquareRoutingMode(mode);
}

export function adminDeliverectMenuPosSectionVisible(
  mode: VendorOrderRoutingMode | string | null | undefined
): boolean {
  return isDeliverectRoutingMode(mode);
}

export function adminRefreshMenuActionLabel(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  if (isDeliverectRoutingMode(mode)) return "Refresh menu from Deliverect";
  if (isSquareRoutingMode(mode)) return "Refresh menu from Square";
  return "Refresh menu";
}

export function adminRefreshMenuActionDescription(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  if (isDeliverectRoutingMode(mode)) {
    return "Triggers the existing Deliverect menu pull. Requires a channel link.";
  }
  if (isSquareRoutingMode(mode)) {
    return "Triggers a Square catalog import when configured.";
  }
  return "Menu refresh is not used for this routing mode.";
}

export function vendorIntegrationsHubDescription(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  const profile = getProviderDisplayProfile(mode);
  return `Active routing, menu source, and connections for ${profile.displayName} and other integrations.`;
}

export function vendorKitchenModeStatusLine(input: {
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined;
  posState: VendorPosUiState;
}): string {
  const { orderRoutingMode, posState } = input;
  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return "Orders appear here when customers order through Open Order.";
  }
  if (isSquareRoutingMode(orderRoutingMode)) {
    return "Kitchen actions here update Open Order directly.";
  }
  if (posState === "connected") {
    return "POS connected — status may sync from kitchen system";
  }
  if (posState === "needs_attention") {
    return "POS needs attention — confirm orders in Open Order if needed";
  }
  return "POS not connected — confirm orders in Open Order if needed";
}

export function vendorKitchenModeNotice(input: {
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined;
  posState: VendorPosUiState;
  squareInjectionOperational?: boolean;
}): string | null {
  const { orderRoutingMode, posState, squareInjectionOperational } = input;

  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return null;
  }

  if (isSquareRoutingMode(orderRoutingMode)) {
    if (squareInjectionOperational) {
      return "Square routing is enabled. Paid Open Order orders are sent to Square as prepaid pickup orders. Kitchen actions here update Open Order directly.";
    }
    return "Square is selected, but order injection is not active. Orders remain in Open Order until routing is fixed or retried.";
  }

  if (isDeliverectRoutingMode(orderRoutingMode)) {
    if (posState === "connected") {
      return "Orders are managed through Deliverect/POS. Kitchen actions may be limited.";
    }
    return "Deliverect is configured, but kitchen actions update Open Order directly.";
  }

  return null;
}

/** Placeholder metadata for future Toast routing — not wired to behavior. */
export function getToastPlaceholderProfile(): ProviderDisplayProfile {
  return TOAST_PLACEHOLDER_PROFILE;
}
