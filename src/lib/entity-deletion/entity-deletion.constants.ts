/** Non-terminal vendor fulfillment — active kitchen/order work still in progress. */
export const TERMINAL_VENDOR_FULFILLMENT_STATUSES = ["completed", "cancelled"] as const;

export function isActiveVendorFulfillmentStatus(status: string): boolean {
  return !(TERMINAL_VENDOR_FULFILLMENT_STATUSES as readonly string[]).includes(status);
}

export {
  BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES,
  BLOCKING_POD_PAYOUT_TRANSFER_STATUSES,
  isBlockingVendorPayoutTransferStatus,
  isBlockingPodPayoutTransferStatus,
} from "@/lib/payout-transfer-recovery";

export function buildDeletedUserEmail(userId: string): string {
  return `deleted+${userId}@accounts.deleted.openorder`;
}

export function isDeletedPlaceholderEmail(email: string): boolean {
  return email.startsWith("deleted+") && email.endsWith("@accounts.deleted.openorder");
}
