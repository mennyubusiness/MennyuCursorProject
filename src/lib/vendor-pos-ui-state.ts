import type { PosConnectionStatus } from "@prisma/client";

/**
 * Vendor-facing POS ↔ Deliverect connection (derived; not stored as an enum).
 * Maps from DB fields + optional webhook-derived flags.
 */
export type VendorPosUiState =
  | "not_connected"
  | "waiting_for_activation"
  | "connected"
  | "needs_attention";

/**
 * Single place to derive vendor POS UI state. No fuzzy logic — uses exact flags only.
 *
 * - `connected`: `deliverectChannelLinkId` is the routing authority (always wins).
 * - `needs_attention`: integration error, channel conflict on vendor, or a stored channel-registration
 *   webhook that referenced this vendor’s Mennyu Location ID but did not match (ops / recovery).
 * - `waiting_for_activation`: guided onboarding in progress, no channel link yet.
 * - `not_connected`: default when none of the above apply.
 */
export function deriveVendorPosUiState(input: {
  deliverectChannelLinkId: string | null;
  posConnectionStatus: PosConnectionStatus;
  deliverectAutoMapLastOutcome: string | null;
  pendingDeliverectConnectionKey: string | null;
  /** True when a recent WebhookEvent (channel registration) had no_match/ambiguous and payload.channelLocationId === vendor.id */
  hasUnmatchedChannelRegistrationForVendor: boolean;
}): VendorPosUiState {
  if (input.deliverectChannelLinkId?.trim()) {
    return "connected";
  }

  if (input.posConnectionStatus === "error") {
    return "needs_attention";
  }

  if (input.deliverectAutoMapLastOutcome === "channel_link_conflict") {
    return "needs_attention";
  }

  if (input.hasUnmatchedChannelRegistrationForVendor) {
    return "needs_attention";
  }

  if (input.posConnectionStatus === "onboarding" || Boolean(input.pendingDeliverectConnectionKey?.trim())) {
    return "waiting_for_activation";
  }

  return "not_connected";
}

export function vendorPosUiStateLabel(state: VendorPosUiState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "waiting_for_activation":
      return "Waiting for activation";
    case "needs_attention":
      return "Needs attention";
    case "not_connected":
    default:
      return "Not connected";
  }
}

export function vendorPosUiStateGuidance(state: VendorPosUiState, opts?: { hasUnmatchedRegistration?: boolean }): string {
  switch (state) {
    case "connected":
      return "Orders can route to your kitchen POS through Deliverect using your channel link.";
    case "waiting_for_activation":
      return "Finish setup in your POS hub. When Deliverect activates the channel, Mennyu will attach it automatically.";
    case "needs_attention":
      if (opts?.hasUnmatchedRegistration) {
        return "We received an activation from Deliverect but could not match it to this restaurant. Confirm your Mennyu Location ID is entered exactly in Deliverect, then try “Check connection again”, or contact support.";
      }
      return "Something blocked automatic linking. Check your setup or contact support — you can also use advanced manual IDs if an admin helps.";
    case "not_connected":
    default:
      return "Connect your POS when you are ready — you can still take orders manually until then.";
  }
}
