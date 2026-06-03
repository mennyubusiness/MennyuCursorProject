/**
 * After a successful customer refund, cancel or block unsent VendorPayoutTransfer rows
 * so refunded obligations cannot be paid via Connect.
 */
import "server-only";

import { prisma } from "@/lib/db";
import {
  CANCELLED_DUE_TO_REFUND_ADMIN_NOTE,
  CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
  CANCELLED_DUE_TO_REFUND_STATUS,
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
  isPaidVendorConnectTransfer,
  isUnsentVendorPayoutTransferForRefund,
  PARTIAL_REFUND_MANUAL_REVIEW_BLOCKED_REASON,
  PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import {
  getOrderRefundSummary,
  getRemainingVendorOrderRefundableCents,
} from "@/services/refund-ledger.service";

export type SyncVendorTransferEligibilityResult = {
  orderId: string;
  examined: number;
  cancelledDueToRefund: number;
  blockedPartialRefundReview: number;
  skippedPaid: number;
  skippedAlreadyHandled: number;
  errors: string[];
};

async function loadUnsentTransfersForVendorOrders(vendorOrderIds: string[]) {
  if (vendorOrderIds.length === 0) return [];
  return prisma.vendorPayoutTransfer.findMany({
    where: { vendorOrderId: { in: vendorOrderIds } },
    select: {
      id: true,
      vendorOrderId: true,
      status: true,
      blockedReason: true,
      stripeTransferId: true,
      amountCents: true,
    },
  });
}

async function resolveAffectedVendorOrderIds(
  orderId: string,
  vendorOrderId: string | null | undefined
): Promise<string[]> {
  if (vendorOrderId?.trim()) return [vendorOrderId.trim()];
  const vos = await prisma.vendorOrder.findMany({
    where: { orderId },
    select: { id: true },
  });
  return vos.map((v) => v.id);
}

async function surfaceCancellationFailure(orderId: string, message: string): Promise<void> {
  try {
    const { createOrderIssue } = await import("@/services/issues.service");
    await createOrderIssue(orderId, "manual_refund", "HIGH", {
      createdBy: "system",
      notes: `Vendor transfer eligibility sync failed after customer refund: ${message.slice(0, 1500)}`,
    });
  } catch (issueErr) {
    console.warn(
      JSON.stringify({
        event: "vendor_transfer_refund_eligibility_issue_create_failed",
        orderId,
        message: issueErr instanceof Error ? issueErr.message : String(issueErr),
      })
    );
  }
}

/**
 * Idempotent: run after customer refund succeeds (OrderRefund status succeeded).
 */
export async function syncVendorTransferEligibilityAfterRefundSuccess(input: {
  orderId: string;
  vendorOrderId?: string | null;
  orderRefundId?: string | null;
  refundAttemptId?: string | null;
}): Promise<SyncVendorTransferEligibilityResult> {
  const result: SyncVendorTransferEligibilityResult = {
    orderId: input.orderId,
    examined: 0,
    cancelledDueToRefund: 0,
    blockedPartialRefundReview: 0,
    skippedPaid: 0,
    skippedAlreadyHandled: 0,
    errors: [],
  };

  try {
    const vendorOrderIds = await resolveAffectedVendorOrderIds(
      input.orderId,
      input.vendorOrderId
    );
    const isOrderScopedRefund = !input.vendorOrderId?.trim();
    const orderRefundSummary = isOrderScopedRefund
      ? await getOrderRefundSummary(input.orderId)
      : null;

    for (const voId of vendorOrderIds) {
      const vo = await prisma.vendorOrder.findUnique({
        where: { id: voId },
        select: { id: true, totalCents: true },
      });
      if (!vo) continue;

      let remainingRefundable: number;
      let shouldProcess: boolean;

      if (isOrderScopedRefund && orderRefundSummary) {
        remainingRefundable = orderRefundSummary.remainingRefundableCents;
        shouldProcess = orderRefundSummary.totalRefundedCents > 0;
      } else {
        remainingRefundable = await getRemainingVendorOrderRefundableCents(voId);
        shouldProcess = remainingRefundable < vo.totalCents;
      }

      if (!shouldProcess) continue;

      const transfers = await loadUnsentTransfersForVendorOrders([voId]);
      for (const transfer of transfers) {
        result.examined++;

        if (isPaidVendorConnectTransfer(transfer)) {
          result.skippedPaid++;
          continue;
        }
        if (
          isCancelledDueToRefundTransfer(transfer) ||
          isPartialRefundManualReviewTransfer(transfer)
        ) {
          result.skippedAlreadyHandled++;
          continue;
        }
        if (!isUnsentVendorPayoutTransferForRefund(transfer)) {
          result.skippedAlreadyHandled++;
          continue;
        }

        if (remainingRefundable === 0) {
          await prisma.vendorPayoutTransfer.update({
            where: { id: transfer.id },
            data: {
              status: CANCELLED_DUE_TO_REFUND_STATUS,
              blockedReason: CANCELLED_DUE_TO_REFUND_BLOCKED_REASON,
              failureMessage: CANCELLED_DUE_TO_REFUND_ADMIN_NOTE,
              failedAt: null,
            },
          });
          result.cancelledDueToRefund++;
          continue;
        }

        await prisma.vendorPayoutTransfer.update({
          where: { id: transfer.id },
          data: {
            status: PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
            blockedReason: PARTIAL_REFUND_MANUAL_REVIEW_BLOCKED_REASON,
            failureMessage: PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
            failedAt: new Date(),
          },
        });
        result.blockedPartialRefundReview++;
      }
    }

    console.info(
      JSON.stringify({
        event: "vendor_transfer_refund_eligibility_synced",
        vendorOrderId: input.vendorOrderId ?? null,
        orderRefundId: input.orderRefundId ?? null,
        refundAttemptId: input.refundAttemptId ?? null,
        ...result,
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(msg);
    console.error(
      JSON.stringify({
        event: "vendor_transfer_refund_eligibility_sync_failed",
        orderId: input.orderId,
        message: msg,
      })
    );
    await surfaceCancellationFailure(input.orderId, msg);
  }

  return result;
}
