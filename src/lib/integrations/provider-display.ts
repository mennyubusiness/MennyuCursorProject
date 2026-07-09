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
    "Paid Open Order orders are sent to Square as prepaid pickup orders when routing prerequisites are met.",
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

/** Provider-agnostic admin order routing section copy. */
export const ADMIN_ORDER_ROUTING_GENERIC_COPY =
  "Menu source and order routing are managed separately. Changing routing does not automatically change the published menu.";

export function adminVendorOverviewRoutingProviderLabel(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  return getProviderDisplayProfile(mode).displayName;
}

export function adminVendorOverviewMenuSourceLabel(input: {
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined;
  menuSource: string | null | undefined;
}): string {
  const { orderRoutingMode, menuSource } = input;
  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return "Open Order menu builder";
  }
  if (isDeliverectRoutingMode(orderRoutingMode)) {
    return "Deliverect sync";
  }
  if (isSquareRoutingMode(orderRoutingMode)) {
    return menuSource === "deliverect" ? "Deliverect sync" : "Square catalog import";
  }
  return "Open Order menu builder";
}

export function adminVendorMenuStatusLabel(input: {
  hasPublishedMenu: boolean;
  hasDraftAwaitingReview: boolean;
  totalItems: number;
}): string {
  if (input.hasDraftAwaitingReview) return "Draft available";
  if (input.hasPublishedMenu || input.totalItems > 0) return "Published";
  return "Missing";
}

export function formatAdminDownstreamPosProvider(
  posProvider: string | null | undefined
): string | null {
  if (!posProvider?.trim()) return null;
  const normalized = posProvider.trim();
  if (normalized.toLowerCase() === "toast") return "Toast";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** Primary routing section shows Square status only for saved or preview-selected Square mode. */
export function adminShowSquareRoutingStatusPrimary(input: {
  savedMode: VendorOrderRoutingMode | string | null | undefined;
  selectedMode: VendorOrderRoutingMode | string | null | undefined;
}): boolean {
  return isSquareRoutingMode(input.savedMode) || isSquareRoutingMode(input.selectedMode);
}

export function adminInactiveSquareDiagnosticsVisible(input: {
  savedMode: VendorOrderRoutingMode | string | null | undefined;
  hasSquareConnection: boolean;
}): boolean {
  return !isSquareRoutingMode(input.savedMode) && input.hasSquareConnection;
}

export function adminInactiveDeliverectDiagnosticsVisible(input: {
  savedMode: VendorOrderRoutingMode | string | null | undefined;
  deliverectChannelLinkId: string | null | undefined;
}): boolean {
  return !isDeliverectRoutingMode(input.savedMode) && Boolean(input.deliverectChannelLinkId?.trim());
}

export type AdminVendorDetailTool = {
  title: string;
  description: string;
  href: string;
};

export function getAdminVendorDetailTools(
  vendorId: string,
  mode: VendorOrderRoutingMode | string | null | undefined
): AdminVendorDetailTool[] {
  const id = vendorId.trim();
  const tools: AdminVendorDetailTool[] = [
    {
      title: "Vendor dashboard",
      description: "Open the vendor command dashboard",
      href: `/vendor/${id}/dashboard`,
    },
  ];

  if (isManualDashboardRoutingMode(mode)) {
    tools.push(
      {
        title: "Kitchen mode",
        description: "Operational order board for dashboard routing",
        href: `/vendor/${id}/kitchen`,
      },
      {
        title: "Menu builder",
        description: "Edit draft menus and publish snapshots",
        href: `/vendor/${id}/menu-builder`,
      }
    );
  }

  if (isDeliverectRoutingMode(mode)) {
    tools.push(
      {
        title: "Deliverect menu imports",
        description: adminMenuManagementToolDescription(mode),
        href: `/admin/vendors/${id}/menu-history`,
      },
      {
        title: "Deliverect POS & channel",
        description: adminPosMappingToolDescription(mode),
        href: `/admin/vendors/${id}/deliverect-mapping`,
      }
    );
  }

  if (isSquareRoutingMode(mode)) {
    tools.push(
      {
        title: "Square menu imports",
        description: adminMenuManagementToolDescription(mode),
        href: `/admin/vendors/${id}/menu-history`,
      },
      {
        title: "Square integration",
        description: "OAuth connection, location, and catalog import",
        href: `/vendor/${id}/integrations/square`,
      },
      {
        title: "Square injection debug",
        description: "Read-only JSON diagnostics for order injection",
        href: `/admin/vendors/${id}/square-routing-debug`,
      }
    );
  }

  if (!isSquareRoutingMode(mode) && !isDeliverectRoutingMode(mode)) {
    tools.push({
      title: "Menu management",
      description: adminMenuManagementToolDescription(mode),
      href: `/admin/vendors/${id}/menu-history`,
    });
  }

  return tools;
}

export function adminSquareRoutingStatusSummary(readiness: {
  injectionOperationalReady: boolean;
  globalRoutingLive: boolean;
  connectionHealthy: boolean;
  hasSquarePublishedMenu: boolean;
  injectionBlockingReasons: string[];
}): { headline: string; ready: boolean; blockers: string[] } {
  const blockers = readiness.injectionBlockingReasons.filter(Boolean);
  if (readiness.injectionOperationalReady) {
    return {
      headline:
        "Square routing is ready. Paid Open Order orders will be sent to Square as prepaid pickup orders.",
      ready: true,
      blockers: [],
    };
  }
  if (!readiness.globalRoutingLive) {
    return {
      headline: "Square routing is selected, but live Square API routing is disabled globally.",
      ready: false,
      blockers,
    };
  }
  if (!readiness.connectionHealthy) {
    return {
      headline: "Square routing is selected. Connect Square to start sending paid orders to Square.",
      ready: false,
      blockers,
    };
  }
  if (!readiness.hasSquarePublishedMenu) {
    return {
      headline:
        "Square routing is selected. Import and publish a Square menu before orders can be sent to Square.",
      ready: false,
      blockers,
    };
  }
  return {
    headline:
      "Square routing is selected. Complete the requirements below before orders can be sent to Square.",
    ready: false,
    blockers,
  };
}

export function adminActiveRoutingStatusMessage(input: {
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined;
  deliverectConnected: boolean;
  posConnectionStatus: string | null | undefined;
  squareStatusMessage: string;
  squareConnectionStatus: string | null | undefined;
}): { message: string; detail?: string } {
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    return {
      message: input.squareStatusMessage,
      detail: input.squareConnectionStatus
        ? `Connection status: ${input.squareConnectionStatus}`
        : undefined,
    };
  }
  if (isDeliverectRoutingMode(input.orderRoutingMode)) {
    return {
      message: input.deliverectConnected
        ? "Deliverect is connected for order routing."
        : "Deliverect is not connected. Channel link and mappings are required before orders can route.",
      detail: input.posConnectionStatus ? `Connection status: ${input.posConnectionStatus}` : undefined,
    };
  }
  return {
    message: "Open Order Dashboard routing is active. No POS connection is required.",
  };
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
    return "Routed orders are managed in Square — status syncs back to Open Order.";
  }
  if (posState === "connected") {
    return "POS connected — manage routed orders in your kitchen system";
  }
  if (posState === "needs_attention") {
    return "POS needs attention — confirm orders in Open Order if routing did not complete";
  }
  return "POS not connected — confirm orders in Open Order if routing did not complete";
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
      return "Square routing is ready. Paid orders are sent to Square — manage kitchen status in Square. Updates sync back to Open Order when configured.";
    }
    return "Square routing is selected but not ready yet. Orders remain in Open Order until Square setup is complete or routing is retried.";
  }

  if (isDeliverectRoutingMode(orderRoutingMode)) {
    if (posState === "connected") {
      return "Orders are managed through Deliverect/POS. Kitchen actions in Open Order are limited for routed orders.";
    }
    return "Deliverect is configured. Routed orders should be managed in your POS; Open Order updates when the provider sends status.";
  }

  return null;
}

export function getKitchenProviderDisplayName(
  mode: VendorOrderRoutingMode | string | null | undefined
): string {
  return getProviderDisplayProfile(mode).displayName;
}

export function getKitchenManagedOrderBadge(
  mode: VendorOrderRoutingMode | string | null | undefined
): string | null {
  if (isManualDashboardRoutingMode(mode)) return "Managed in Open Order";
  if (isSquareRoutingMode(mode)) return "Managed in Square";
  if (isDeliverectRoutingMode(mode)) return "Managed in Deliverect";
  return null;
}

/** true = sync known on; false = sync known off; null = unknown (do not claim missing). */
export type KitchenStatusSyncConfigured = boolean | null;

export function getKitchenVendorLockMessage(input: {
  provider: VendorOrderRoutingMode | string;
  statusSyncAvailable: KitchenStatusSyncConfigured;
}): string {
  const { provider, statusSyncAvailable } = input;
  if (isSquareRoutingMode(provider)) {
    if (statusSyncAvailable === true) {
      return "Manage this order in Square. Updates from Square will sync back to Open Order.";
    }
    if (statusSyncAvailable === false) {
      return "Manage this order in Square. Webhook sync is not configured, so Open Order may not update automatically.";
    }
    return "Manage this order in Square. Open Order will update when status sync is available.";
  }
  if (isDeliverectRoutingMode(provider)) {
    if (statusSyncAvailable === true) {
      return "Manage this order through Deliverect/POS. Status updates from Deliverect/POS update Open Order.";
    }
    if (statusSyncAvailable === false) {
      return "Manage this order through Deliverect/POS. Open Order status may need admin recovery if the provider does not send updates.";
    }
    return "Manage this order through Deliverect/POS. Open Order will update when status sync is available.";
  }
  return "This order is managed externally. Update it in your connected system.";
}

export function getKitchenStatusSyncCopy(input: {
  provider: VendorOrderRoutingMode | string;
  statusSyncAvailable: KitchenStatusSyncConfigured;
}): string | null {
  const { provider, statusSyncAvailable } = input;
  if (isManualDashboardRoutingMode(provider)) return null;
  if (isSquareRoutingMode(provider)) {
    if (statusSyncAvailable === true) {
      return "Status updates from Square will update Open Order.";
    }
    if (statusSyncAvailable === false) {
      return "Status updates should be made in Square. Webhook sync is not configured, so Open Order may not update automatically.";
    }
    return "Open Order will update when status sync is available.";
  }
  if (isDeliverectRoutingMode(provider)) {
    if (statusSyncAvailable === true) {
      return "Status updates from Deliverect/POS update Open Order.";
    }
    if (statusSyncAvailable === false) {
      return "Orders are managed through Deliverect/POS. Open Order status may need admin recovery if the provider does not send updates.";
    }
    return "Open Order will update when status sync is available.";
  }
  return null;
}

export function getKitchenRecoveryCopy(input: {
  provider: VendorOrderRoutingMode | string;
  routingFailed: boolean;
  recovered: boolean;
}): string | null {
  if (input.recovered) {
    return "Manually recovered — continue managing this order in Open Order.";
  }
  if (input.routingFailed) {
    return "Routing failed. Open Order still has the paid order.";
  }
  return null;
}

/** Placeholder metadata for future Toast routing — not wired to behavior. */
export function getToastPlaceholderProfile(): ProviderDisplayProfile {
  return TOAST_PLACEHOLDER_PROFILE;
}
