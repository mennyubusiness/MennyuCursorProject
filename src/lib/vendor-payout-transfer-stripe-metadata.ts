/**
 * Stripe Connect transfer metadata / transfer_group for vendor payout rows.
 */

export type VendorPayoutTransferStripeContext = {
  id: string;
  paymentAllocationId: string;
  vendorOrderId: string;
  vendorId: string;
  orderId: string;
};

export function buildVendorPayoutTransferStripeMetadata(
  row: VendorPayoutTransferStripeContext
): Record<string, string> {
  return {
    openOrderVendorPayoutTransferId: row.id,
    paymentAllocationId: row.paymentAllocationId,
    orderId: row.orderId,
    vendorOrderId: row.vendorOrderId,
    vendorId: row.vendorId,
    /** Legacy keys — keep for historical reconciliation. */
    mennyu_vendor_payout_transfer_id: row.id,
    mennyu_payment_allocation_id: row.paymentAllocationId,
  };
}

export function buildVendorPayoutTransferGroup(orderId: string): string {
  return `order_${orderId}`;
}
