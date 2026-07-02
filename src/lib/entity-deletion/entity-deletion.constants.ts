/** Non-terminal vendor fulfillment — active kitchen/order work still in progress. */
export const TERMINAL_VENDOR_FULFILLMENT_STATUSES = ["completed", "cancelled"] as const;

export function isActiveVendorFulfillmentStatus(status: string): boolean {
  return !(TERMINAL_VENDOR_FULFILLMENT_STATUSES as readonly string[]).includes(status);
}

/** Vendor payout transfer rows that should block owner deletion until resolved. */
export const BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES = ["pending", "blocked", "submitted"] as const;

export function isBlockingVendorPayoutTransferStatus(status: string): boolean {
  return (BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES as readonly string[]).includes(status);
}

/** Pod payout transfer rows that should block pod deletion until resolved. */
export const BLOCKING_POD_PAYOUT_TRANSFER_STATUSES = ["pending", "blocked", "submitted"] as const;

export function isBlockingPodPayoutTransferStatus(status: string): boolean {
  return (BLOCKING_POD_PAYOUT_TRANSFER_STATUSES as readonly string[]).includes(status);
}

export function buildDeletedUserEmail(userId: string): string {
  return `deleted+${userId}@accounts.deleted.openorder`;
}

export function isDeletedPlaceholderEmail(email: string): boolean {
  return email.startsWith("deleted+") && email.endsWith("@accounts.deleted.openorder");
}
