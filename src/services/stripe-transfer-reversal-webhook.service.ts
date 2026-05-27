/**
 * Stripe transfer.reversed webhook — reconcile VendorPayoutTransferReversal rows when possible.
 */
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS } from "@/services/vendor-payout-transfer-reversal.service";

export type TransferReversedSyncResult =
  | { outcome: "synced"; reversalIds: string[] }
  | { outcome: "unmatched"; reason: string };

/**
 * When Stripe reports a transfer reversal, mark pending/submitted reversal rows as reversed
 * if they match the parent transfer ID. Does not create new reversal rows.
 */
export async function syncTransferReversedFromStripeWebhook(
  transfer: Stripe.Transfer
): Promise<TransferReversedSyncResult> {
  const transferId = transfer.id;
  const vpt = await prisma.vendorPayoutTransfer.findFirst({
    where: { stripeTransferId: transferId },
    select: { id: true },
  });
  if (!vpt) {
    return { outcome: "unmatched", reason: "no_vendor_payout_transfer_for_stripe_transfer" };
  }

  const rows = await prisma.vendorPayoutTransferReversal.findMany({
    where: {
      vendorPayoutTransferId: vpt.id,
      status: { in: ["pending", "submitted"] },
    },
    select: { id: true },
  });

  if (rows.length === 0) {
    return {
      outcome: "unmatched",
      reason: "no_pending_reversal_rows_for_transfer",
    };
  }

  const reversedIds: string[] = [];
  for (const row of rows) {
    await prisma.vendorPayoutTransferReversal.update({
      where: { id: row.id },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_REVERSAL_STATUS.reversed,
        submittedAt: new Date(),
        failureMessage: null,
      },
    });
    reversedIds.push(row.id);
  }

  return { outcome: "synced", reversalIds: reversedIds };
}
