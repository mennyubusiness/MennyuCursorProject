import "server-only";

import { prisma } from "@/lib/db";
import {
  emptyReEvaluateSummary,
  isVendorReEvaluateSkippedTerminal,
  VENDOR_REEVALUATE_TRANSFER_STATUSES,
  type PayoutReEvaluateSummary,
} from "@/lib/payout-transfer-recovery";
import { isVendorTransferExecutionBlockedByRefund } from "@/lib/vendor-payout-transfer-refund-eligibility";
import {
  BLOCKED_DESTINATION_SENTINEL,
  blockedReasonForVendor,
  isVendorConnectPayoutReady,
  VENDOR_PAYOUT_TRANSFER_STATUS,
} from "@/services/vendor-payout-transfer.service";

const RECHECK_NOTE = "Rechecked blocked transfer — eligible to send again.";

export async function reEvaluateBlockedVendorPayoutTransferRows(params?: {
  vendorId?: string;
  take?: number;
}): Promise<PayoutReEvaluateSummary> {
  const summary = emptyReEvaluateSummary();
  const rows = await prisma.vendorPayoutTransfer.findMany({
    where: {
      status: { in: [...VENDOR_REEVALUATE_TRANSFER_STATUSES] },
      ...(params?.vendorId ? { vendorId: params.vendorId } : {}),
      OR: [{ stripeTransferId: null }, { stripeTransferId: "" }],
    },
    include: {
      vendor: {
        select: {
          stripeConnectedAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    ...(params?.take != null ? { take: params.take } : {}),
  });

  for (const row of rows) {
    summary.examined++;

    if (!row.vendor || row.vendor.deletedAt) {
      summary.skippedTerminal++;
      continue;
    }

    if (isVendorReEvaluateSkippedTerminal(row.status) || isVendorTransferExecutionBlockedByRefund(row)) {
      summary.skippedTerminal++;
      continue;
    }

    const ready = isVendorConnectPayoutReady(row.vendor);
    const previousStatus = row.status;
    const previousDestination = row.destinationAccountId;
    const previousReason = row.blockedReason;

    if (!ready) {
      const nextReason = blockedReasonForVendor(row.vendor);
      if (
        row.status !== VENDOR_PAYOUT_TRANSFER_STATUS.blocked ||
        row.destinationAccountId !== BLOCKED_DESTINATION_SENTINEL ||
        row.blockedReason !== nextReason
      ) {
        await prisma.vendorPayoutTransfer.update({
          where: { id: row.id },
          data: {
            status: VENDOR_PAYOUT_TRANSFER_STATUS.blocked,
            destinationAccountId: BLOCKED_DESTINATION_SENTINEL,
            blockedReason: nextReason,
          },
        });
        summary.updatedBlocked++;
      } else {
        summary.unchanged++;
      }
      continue;
    }

    const destination = row.vendor.stripeConnectedAccountId!.trim();
    const shouldPromote =
      row.status === VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance ||
      row.status === VENDOR_PAYOUT_TRANSFER_STATUS.blocked ||
      row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL;

    if (!shouldPromote) {
      summary.unchanged++;
      continue;
    }

    if (
      row.status === VENDOR_PAYOUT_TRANSFER_STATUS.pending &&
      row.destinationAccountId === destination &&
      !row.blockedReason &&
      !row.failureMessage
    ) {
      summary.unchanged++;
      continue;
    }

    await prisma.vendorPayoutTransfer.update({
      where: { id: row.id },
      data: {
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
        destinationAccountId: destination,
        blockedReason: null,
        failureMessage:
          previousStatus !== VENDOR_PAYOUT_TRANSFER_STATUS.pending ||
          previousDestination !== destination ||
          previousReason
            ? RECHECK_NOTE
            : row.failureMessage,
        failedAt: null,
      },
    });
    summary.promotedToPending++;
  }

  return summary;
}
