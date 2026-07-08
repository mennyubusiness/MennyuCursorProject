import type { VendorOrderRoutingMode } from "@prisma/client";
import type { PosConnectionStatus } from "@prisma/client";
import { vendorKitchenModeNotice, vendorKitchenModeStatusLine } from "@/lib/integrations/provider-display";
import { vendorPosConnectionLabel } from "@/lib/vendor-operational-copy";
import type { VendorPosUiState } from "@/lib/vendor-pos-ui-state";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";

export type { VendorOrderRoutingMode };

export const VENDOR_ORDER_ROUTING_MODES = [
  "manual_dashboard",
  "deliverect",
  "square",
] as const satisfies readonly VendorOrderRoutingMode[];

export function normalizeVendorOrderRoutingMode(
  mode: VendorOrderRoutingMode | string | null | undefined
): VendorOrderRoutingMode {
  if (mode === "deliverect") return "deliverect";
  if (mode === "square") return "square";
  return "manual_dashboard";
}

export function isDeliverectRoutingMode(mode: VendorOrderRoutingMode | string | null | undefined): boolean {
  return normalizeVendorOrderRoutingMode(mode) === "deliverect";
}

export function isSquareRoutingMode(mode: VendorOrderRoutingMode | string | null | undefined): boolean {
  return normalizeVendorOrderRoutingMode(mode) === "square";
}

export function isManualDashboardRoutingMode(mode: VendorOrderRoutingMode | string | null | undefined): boolean {
  return normalizeVendorOrderRoutingMode(mode) === "manual_dashboard";
}

export function vendorOrderRoutingModeShortLabel(mode: VendorOrderRoutingMode | string | null | undefined): string {
  if (isDeliverectRoutingMode(mode)) return "Deliverect";
  if (isSquareRoutingMode(mode)) return "Square";
  return "Manual dashboard";
}

export function vendorOrderRoutingModeAdminLabel(mode: VendorOrderRoutingMode | string | null | undefined): string {
  if (isDeliverectRoutingMode(mode)) return "Deliverect / POS-connected routing";
  if (isSquareRoutingMode(mode)) return "Square / POS-connected routing";
  return "Open Order Dashboard / Tablet";
}

export type VendorPosConnectionSummary = {
  deliverectChannelLinkId: string | null;
  posConnectionStatus: PosConnectionStatus;
  deliverectAutoMapLastOutcome: string | null;
  pendingDeliverectConnectionKey: string | null;
  hasUnmatchedChannelRegistration?: boolean;
};

export function isVendorDeliverectPosConnected(pos: VendorPosConnectionSummary): boolean {
  return (
    deriveVendorPosUiState({
      deliverectChannelLinkId: pos.deliverectChannelLinkId,
      posConnectionStatus: pos.posConnectionStatus,
      deliverectAutoMapLastOutcome: pos.deliverectAutoMapLastOutcome,
      pendingDeliverectConnectionKey: pos.pendingDeliverectConnectionKey,
      hasUnmatchedChannelRegistrationForVendor: pos.hasUnmatchedChannelRegistration ?? false,
    }) === "connected"
  );
}

export type VendorRoutingReadinessInput = VendorPosConnectionSummary & {
  orderRoutingMode?: VendorOrderRoutingMode | null;
  deliverectMappingReady?: boolean;
  /** Vendor OAuth connection healthy with selected location (setup checklist). */
  squareConnectionReady?: boolean;
  squareOrderRoutingEnabled?: boolean;
  /** Precomputed: Square connection + published Square menu (from loadSquareOrderRoutingReadiness). */
  squareOrderRoutingReady?: boolean;
};

/**
 * Vendor-facing setup readiness for the POS / routing checklist row.
 * Square mode checks OAuth connection only — not admin order-injection enablement.
 */
export function isVendorSetupPosReady(input: VendorRoutingReadinessInput): boolean {
  if (isManualDashboardRoutingMode(input.orderRoutingMode)) {
    return true;
  }
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    return input.squareConnectionReady === true;
  }
  if (!isVendorDeliverectPosConnected(input)) {
    return false;
  }
  return input.deliverectMappingReady !== false;
}

/**
 * Operational routing readiness: manual mode always passes; Deliverect mode requires
 * channel link + completed product/modifier mappings; Square requires explicit enable + readiness.
 */
export function isVendorRoutingOperationalReady(input: VendorRoutingReadinessInput): boolean {
  if (isManualDashboardRoutingMode(input.orderRoutingMode)) {
    return true;
  }
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    return input.squareOrderRoutingEnabled === true && input.squareOrderRoutingReady === true;
  }
  if (!isVendorDeliverectPosConnected(input)) {
    return false;
  }
  return input.deliverectMappingReady !== false;
}

export function vendorRoutingSetupBlockerLabel(input: VendorRoutingReadinessInput): string | null {
  if (isManualDashboardRoutingMode(input.orderRoutingMode)) {
    return null;
  }
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    if (!input.squareOrderRoutingEnabled) {
      return "Square order routing is selected but not enabled yet.";
    }
    if (!input.squareOrderRoutingReady) {
      return "Square order routing is enabled but prerequisites are incomplete (connection, location, or published Square menu).";
    }
    return null;
  }
  if (!isVendorDeliverectPosConnected(input)) {
    return "Deliverect is not connected.";
  }
  if (input.deliverectMappingReady === false) {
    return "Deliverect product or modifier mappings are incomplete.";
  }
  return null;
}

export const VENDOR_ROUTING_MODE_COPY = {
  manualDashboard: {
    adminHelper:
      "Orders appear in the Open Order vendor dashboard. This is the fastest setup and does not require POS integration.",
    vendorHelper:
      "Your orders come into the Open Order dashboard. Keep this screen open during service so you can accept and manage orders.",
  },
  deliverect: {
    adminHelper:
      "Orders are sent to Deliverect for POS/kitchen routing where supported. Requires Deliverect setup and completed mappings.",
    vendorHelper:
      "Your orders are routed through Deliverect where supported. If orders fail to route, Open Order may require admin review or fallback handling.",
    incompleteWarning:
      "Deliverect routing is selected but setup is incomplete. This vendor cannot receive orders until Deliverect is connected and mappings are complete.",
  },
  square: {
    adminHelper:
      "Orders will route through Square when order injection is live. Requires a healthy Square OAuth connection with a selected active location. Menu source stays on Open Order until Square menu publish is enabled.",
    vendorHelper:
      "Your orders are configured for Square routing. Order injection must be enabled before customers can place orders with this routing mode.",
    incompleteWarning:
      "Square routing is selected but order injection is not enabled or prerequisites are incomplete.",
    notConnectedWarning:
      "Square is not ready. The vendor must connect Square and select an active location before Square routing can be enabled.",
  },
} as const;

/** Dashboard / status card label for the active routing mode (not raw POS connection when manual). */
export function vendorRoutingStatusLabel(
  mode: VendorOrderRoutingMode | string | null | undefined,
  posState: VendorPosUiState
): string {
  if (isManualDashboardRoutingMode(mode)) {
    return vendorOrderRoutingModeAdminLabel(mode);
  }
  if (isSquareRoutingMode(mode)) {
    return "Square routing";
  }
  return vendorPosConnectionLabel(posState);
}

/** Field label beside routing status on vendor dashboard cards. */
export function vendorRoutingStatusFieldLabel(mode: VendorOrderRoutingMode | string | null | undefined): string {
  return isManualDashboardRoutingMode(mode) ? "Order routing" : "POS";
}

export function vendorMenuSyncLabelForRouting(input: {
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined;
  menuReady: boolean;
  hasOperationalItems: boolean;
  posConnected: boolean;
}): string {
  if (!input.hasOperationalItems) return "Menu sync needs attention";
  if (input.menuReady) {
    return isDeliverectRoutingMode(input.orderRoutingMode) && input.posConnected
      ? "Menu synced from POS"
      : "Menu ready";
  }
  return "No items available to order";
}

/** True when Open Order should treat order boards as POS-managed (Deliverect mode + connected). */
export function isVendorPosManagedForUi(
  mode: VendorOrderRoutingMode | string | null | undefined,
  posState: VendorPosUiState
): boolean {
  return isDeliverectRoutingMode(mode) && posState === "connected";
}

/** True when Deliverect routing retry / authority UI applies for this vendor. */
export function isVendorDeliverectLiveForUi(
  mode: VendorOrderRoutingMode | string | null | undefined,
  routingRetryAvailable: boolean
): boolean {
  return isDeliverectRoutingMode(mode) && routingRetryAvailable;
}

/** True when menu copy should describe POS-managed sync (Deliverect mode + connected). */
export function isVendorPosMenuManagedForUi(
  mode: VendorOrderRoutingMode | string | null | undefined,
  posConnected: boolean
): boolean {
  return isDeliverectRoutingMode(mode) && posConnected;
}

export function vendorKitchenStatusLine(
  mode: VendorOrderRoutingMode | string | null | undefined,
  posState: VendorPosUiState
): string {
  return vendorKitchenModeStatusLine({ orderRoutingMode: mode, posState });
}

export function vendorKitchenStatusWarning(
  mode: VendorOrderRoutingMode | string | null | undefined,
  posState: VendorPosUiState,
  options?: { squareInjectionOperational?: boolean }
): string | null {
  return vendorKitchenModeNotice({
    orderRoutingMode: mode,
    posState,
    squareInjectionOperational: options?.squareInjectionOperational,
  });
}

export function vendorSetupPageIncompleteDescription(
  _mode?: VendorOrderRoutingMode | string | null
): string {
  return "Complete your public profile, menu, hours, payouts, and order routing setup before accepting orders.";
}

export function vendorSetupOperationalLockedDescription(
  _mode?: VendorOrderRoutingMode | string | null
): string {
  return "Finish the public profile requirements above first. Payment, order routing, and ordering controls unlock after your vendor is visible on the pod page.";
}

export function vendorSetupIncompleteBannerCopy(
  _mode?: VendorOrderRoutingMode | string | null
): string {
  return "— finish setup on the Setup page when you are ready.";
}
