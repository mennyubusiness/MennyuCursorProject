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

/** Admin UI: routing mode is always selectable; prerequisites are shown after selection. */
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
    isSelectable: true,
    hasConnection: Boolean(connection),
    health,
    businessName,
    locationName,
    connectionStatus: connection?.status ?? null,
    missingRequirements: health.missingRequirements,
    statusMessage: health.isReady
      ? formatSquareRoutingConnectedMessage({ businessName, locationName })
      : "Square is not connected yet. Connect Square and select a location to finish setup.",
    integrationUrl: `/vendor/${vendorId}/integrations/square`,
    menuImportsUrl: `/vendor/${vendorId}/menu/imports`,
  };
}

/** @deprecated Routing mode is always selectable — kept for callers expecting ok. */
export async function assertSquareRoutingSelectable(vendorId: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  void vendorId;
  return { ok: true };
}
