import type { PosConnectionStatus } from "@prisma/client";

/** True when vendor has any vendor-level POS/Deliverect connection worth clearing. */
export function vendorHasActivePosConnection(vendor: {
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  deliverectAccountId: string | null;
  deliverectAccountEmail: string | null;
  pendingDeliverectConnectionKey?: string | null;
  posConnectionStatus: PosConnectionStatus;
}): boolean {
  if (vendor.deliverectChannelLinkId?.trim()) return true;
  if (vendor.deliverectLocationId?.trim()) return true;
  if (vendor.deliverectAccountId?.trim()) return true;
  if (vendor.deliverectAccountEmail?.trim()) return true;
  if (vendor.pendingDeliverectConnectionKey?.trim()) return true;
  return vendor.posConnectionStatus === "connected" || vendor.posConnectionStatus === "onboarding";
}
