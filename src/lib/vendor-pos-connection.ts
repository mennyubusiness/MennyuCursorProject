import type { PosConnectionStatus } from "@prisma/client";

/**
 * Display status for POS integration UI. If a channel link exists in DB, treat as connected
 * even if status enum was not backfilled.
 */
export function effectivePosConnectionStatus(vendor: {
  posConnectionStatus: PosConnectionStatus;
  deliverectChannelLinkId: string | null;
}): PosConnectionStatus {
  const hasChannel = Boolean(vendor.deliverectChannelLinkId?.trim());
  if (hasChannel) return "connected";
  return vendor.posConnectionStatus;
}

export function posConnectionLabel(status: PosConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "onboarding":
      return "In progress";
    case "not_connected":
    default:
      return "Not connected";
  }
}
