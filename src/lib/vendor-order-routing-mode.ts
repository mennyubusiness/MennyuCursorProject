import type { VendorOrderRoutingMode } from "@prisma/client";
import type { PosConnectionStatus } from "@prisma/client";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";

export type { VendorOrderRoutingMode };

export const VENDOR_ORDER_ROUTING_MODES = ["manual_dashboard", "deliverect"] as const satisfies readonly VendorOrderRoutingMode[];

export function normalizeVendorOrderRoutingMode(
  mode: VendorOrderRoutingMode | string | null | undefined
): VendorOrderRoutingMode {
  return mode === "deliverect" ? "deliverect" : "manual_dashboard";
}

export function isDeliverectRoutingMode(mode: VendorOrderRoutingMode | string | null | undefined): boolean {
  return normalizeVendorOrderRoutingMode(mode) === "deliverect";
}

export function isManualDashboardRoutingMode(mode: VendorOrderRoutingMode | string | null | undefined): boolean {
  return !isDeliverectRoutingMode(mode);
}

export function vendorOrderRoutingModeShortLabel(mode: VendorOrderRoutingMode | string | null | undefined): string {
  return isDeliverectRoutingMode(mode) ? "Deliverect" : "Manual dashboard";
}

export function vendorOrderRoutingModeAdminLabel(mode: VendorOrderRoutingMode | string | null | undefined): string {
  return isDeliverectRoutingMode(mode)
    ? "Deliverect / POS-connected routing"
    : "Open Order Dashboard / Tablet";
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
};

/**
 * Operational routing readiness: manual mode always passes; Deliverect mode requires
 * channel link + completed product/modifier mappings (when deliverectMappingReady is supplied).
 */
export function isVendorRoutingOperationalReady(input: VendorRoutingReadinessInput): boolean {
  if (isManualDashboardRoutingMode(input.orderRoutingMode)) {
    return true;
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
    serviceReminder: "Keep the Open Order dashboard or tablet open during service.",
  },
  deliverect: {
    adminHelper:
      "Orders are sent to Deliverect for POS/kitchen routing where supported. Requires Deliverect setup and completed mappings.",
    vendorHelper:
      "Your orders are routed through Deliverect where supported. If orders fail to route, Open Order may require admin review or fallback handling.",
    incompleteWarning:
      "Deliverect routing is selected but setup is incomplete. This vendor cannot receive orders until Deliverect is connected and mappings are complete.",
  },
} as const;
