import type { PosConnectionStatus } from "@prisma/client";
import type { VendorMenuSource } from "@prisma/client";
import { normalizeVendorOrderRoutingMode } from "@/lib/vendor-order-routing-mode";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";

/**
 * Canonical Prisma `PosConnectionStatus` values:
 * `not_connected` | `onboarding` | `connected` | `error`
 *
 * `"pending"` is not a stored enum value. Treat it as a legacy/alias label for
 * in-progress Deliverect linking and map it to `onboarding`.
 */
export function normalizePosConnectionStatus(
  status: string | null | undefined
): PosConnectionStatus {
  switch (status) {
    case "connected":
      return "connected";
    case "error":
      return "error";
    case "onboarding":
      return "onboarding";
    case "pending":
      return "onboarding";
    case "not_connected":
    default:
      return "not_connected";
  }
}

function normalizeVendorMenuSource(source: string | null | undefined): VendorMenuSource {
  return source === "deliverect" ? "deliverect" : "open_order";
}

/**
 * Minimal POS readiness summary when the server bundle is unavailable.
 * Safe for Square / manual / Deliverect routing UI (connection checks use these fields).
 */
export function buildVendorPosReadinessFallback(input: {
  posConnectionStatus: string | null | undefined;
  deliverectChannelLinkId: string | null;
  orderRoutingMode: string | null | undefined;
  menuSource: string | null | undefined;
}): VendorPosReadinessSummary {
  return {
    posConnectionStatus: normalizePosConnectionStatus(input.posConnectionStatus),
    deliverectChannelLinkId: input.deliverectChannelLinkId,
    deliverectAutoMapLastOutcome: null,
    pendingDeliverectConnectionKey: null,
    hasUnmatchedChannelRegistration: false,
    orderRoutingMode: normalizeVendorOrderRoutingMode(input.orderRoutingMode),
    menuSource: normalizeVendorMenuSource(input.menuSource),
  };
}
