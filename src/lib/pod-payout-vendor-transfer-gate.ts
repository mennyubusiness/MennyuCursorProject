/**
 * Pod payouts should not proceed until related vendor Connect transfers for the same payment are handled.
 */
import { CANCELLED_DUE_TO_REFUND_STATUS } from "@/lib/vendor-payout-transfer-refund-eligibility";

export type VendorPayoutTransferGateRow = {
  amountCents: number;
  status: string;
};

export type PaymentAllocationVendorGateRow = {
  netVendorTransferCents: number;
  payoutTransfer: VendorPayoutTransferGateRow | null;
};

/** Zero-dollar and cancelled vendor obligations do not block pod payout. */
export function isVendorPayoutTransferHandled(row: VendorPayoutTransferGateRow): boolean {
  if (row.amountCents <= 0) return true;
  if (row.status === "paid") return true;
  if (row.status === CANCELLED_DUE_TO_REFUND_STATUS) return true;
  return false;
}

export type VendorPayoutGateResult =
  | { handled: true }
  | { handled: false; reason: "waiting_on_vendor_transfer" | "no_vendor_allocations" };

/**
 * All payment allocations for the order payment must be vendor-handled before pod payout.
 */
export function resolveVendorPayoutGateForPayment(
  paymentAllocations: PaymentAllocationVendorGateRow[]
): VendorPayoutGateResult {
  if (paymentAllocations.length === 0) {
    return { handled: false, reason: "no_vendor_allocations" };
  }

  for (const alloc of paymentAllocations) {
    if (alloc.netVendorTransferCents <= 0) continue;

    const transfer = alloc.payoutTransfer;
    if (!transfer) {
      return { handled: false, reason: "waiting_on_vendor_transfer" };
    }
    if (!isVendorPayoutTransferHandled(transfer)) {
      return { handled: false, reason: "waiting_on_vendor_transfer" };
    }
  }

  return { handled: true };
}
