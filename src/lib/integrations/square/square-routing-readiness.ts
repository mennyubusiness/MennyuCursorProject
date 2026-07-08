import "server-only";

import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import {
  evaluateSquareConnectionHealth,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";

export type AdminSquareRoutingStatus = {
  isSelectable: boolean;
  hasConnection: boolean;
  health: ProviderConnectionHealth;
  businessName: string | null;
  locationName: string | null;
  connectionStatus: string | null;
  missingRequirements: string[];
  statusMessage: string;
  integrationUrl: string;
  menuImportsUrl: string;
};

const SQUARE_NOT_READY_MESSAGE =
  "Square is not ready. The vendor must connect Square and select an active location before Square routing can be enabled.";

export const SQUARE_ROUTING_NOT_SELECTABLE_ERROR =
  "Square must be connected with a selected active location before this vendor can use Square routing.";

export function formatSquareRoutingConnectedMessage(input: {
  businessName: string | null;
  locationName: string | null;
}): string {
  const business = input.businessName?.trim();
  const location = input.locationName?.trim();
  if (business && location) {
    return `Square is connected to ${business} — ${location}.`;
  }
  if (location) {
    return `Square is connected — ${location}.`;
  }
  if (business) {
    return `Square is connected to ${business}.`;
  }
  return "Square is connected.";
}

/** Admin UI + server validation: Square routing selectable when OAuth connection health is ready. */
export async function loadAdminSquareRoutingStatus(vendorId: string): Promise<AdminSquareRoutingStatus> {
  const [connection, health] = await Promise.all([
    getActiveSquareConnectionForVendor(vendorId),
    evaluateSquareConnectionHealth(vendorId),
  ]);

  const businessName =
    connection?.displayName?.replace(/^Square — /, "").trim() ||
    connection?.externalMerchantId ||
    null;
  const locationName = connection?.capabilitiesMeta?.selectedLocationName ?? null;

  return {
    isSelectable: health.isReady,
    hasConnection: Boolean(connection),
    health,
    businessName,
    locationName,
    connectionStatus: connection?.status ?? null,
    missingRequirements: health.missingRequirements,
    statusMessage: health.isReady
      ? formatSquareRoutingConnectedMessage({ businessName, locationName })
      : SQUARE_NOT_READY_MESSAGE,
    integrationUrl: `/vendor/${vendorId}/integrations/square`,
    menuImportsUrl: `/vendor/${vendorId}/menu/imports`,
  };
}

export async function assertSquareRoutingSelectable(vendorId: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const status = await loadAdminSquareRoutingStatus(vendorId);
  if (status.isSelectable) return { ok: true };
  return { ok: false, error: SQUARE_ROUTING_NOT_SELECTABLE_ERROR };
}
