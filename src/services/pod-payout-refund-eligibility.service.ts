/**
 * After a successful customer refund, cancel or block pod payout allocation/transfer rows
 * so refunded obligations cannot be paid via Connect.
 */
import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolvePodPayoutRefundSyncDecision } from "@/lib/pod-payout-refund-eligibility";
import type { PaymentRefundStatusForPodTransfer } from "@/lib/pod-payout-transfer-refund-eligibility";

export type SyncPodPayoutEligibilityResult = {
  orderId: string;
  examined: number;
  cancelledDueToRefund: number;
  blockedPartialRefundReview: number;
  postTransferRefundReview: number;
  skippedAlreadyHandled: number;
  skippedSentTransfer: number;
  errors: string[];
};

export async function syncPodPayoutEligibilityAfterRefundSuccess(input: {
  orderId: string;
  orderRefundId?: string | null;
  refundAttemptId?: string | null;
}): Promise<SyncPodPayoutEligibilityResult> {
  const result: SyncPodPayoutEligibilityResult = {
    orderId: input.orderId,
    examined: 0,
    cancelledDueToRefund: 0,
    blockedPartialRefundReview: 0,
    postTransferRefundReview: 0,
    skippedAlreadyHandled: 0,
    skippedSentTransfer: 0,
    errors: [],
  };

  try {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { paymentRefundStatus: true },
    });
    if (!order) return result;

    const paymentRefundStatus = order.paymentRefundStatus as PaymentRefundStatusForPodTransfer;
    if (
      paymentRefundStatus !== "full" &&
      paymentRefundStatus !== "partial" &&
      paymentRefundStatus !== "pending"
    ) {
      return result;
    }

    const allocations = await prisma.podPayoutAllocation.findMany({
      where: { orderId: input.orderId },
      include: {
        podPayoutTransfer: {
          select: {
            id: true,
            status: true,
            blockedReason: true,
            stripeTransferId: true,
          },
        },
      },
    });

    if (allocations.length === 0) return result;

    const podIdsToRevalidate = new Set<string>();

    for (const allocation of allocations) {
      result.examined++;
      const transfer = allocation.podPayoutTransfer;

      const decision = resolvePodPayoutRefundSyncDecision({
        allocation: {
          status: allocation.status,
          blockedReason: allocation.blockedReason,
        },
        transfer: transfer
          ? {
              status: transfer.status,
              blockedReason: transfer.blockedReason,
              stripeTransferId: transfer.stripeTransferId,
            }
          : null,
        paymentRefundStatus,
      });

      if (decision.action === "noop") {
        result.skippedAlreadyHandled++;
        continue;
      }

      const now = new Date();

      if (decision.action === "post_transfer_review") {
        await prisma.podPayoutAllocation.update({
          where: { id: allocation.id },
          data: {
            status: decision.allocationStatus,
            blockedReason: decision.allocationBlockedReason,
            updatedAt: now,
          },
        });
        result.postTransferRefundReview++;
        podIdsToRevalidate.add(allocation.podId);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.podPayoutAllocation.update({
          where: { id: allocation.id },
          data: {
            status: decision.allocationStatus,
            blockedReason: decision.allocationBlockedReason,
            updatedAt: now,
          },
        });

        if (decision.updateTransfer && transfer) {
          await tx.podPayoutTransfer.update({
            where: { id: transfer.id },
            data: {
              status: decision.transferStatus,
              blockedReason: decision.transferBlockedReason,
              failureMessage: decision.transferFailureMessage,
              failedAt: decision.action === "block_review" ? now : null,
              updatedAt: now,
            },
          });
        }
      });

      if (decision.action === "cancel") {
        result.cancelledDueToRefund++;
      } else {
        result.blockedPartialRefundReview++;
      }
      podIdsToRevalidate.add(allocation.podId);
    }

    for (const podId of podIdsToRevalidate) {
      revalidatePath(`/admin/pods/${podId}`);
    }

    console.info(
      JSON.stringify({
        event: "pod_payout_refund_eligibility_synced",
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
        event: "pod_payout_refund_eligibility_sync_failed",
        orderId: input.orderId,
        message: msg,
      })
    );
  }

  return result;
}
