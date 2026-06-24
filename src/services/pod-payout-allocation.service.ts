/**
 * Pod owner revenue share allocation at payment time (P1: records only — no Stripe transfers).
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { resolvePodPayoutAllocationDecision } from "@/lib/pod-payout-allocation";

export type EnsurePodPayoutAllocationInput = {
  paymentId: string;
  orderId: string;
  podId: string;
  /** Order.subtotalCents — food subtotal only. */
  eligibleSubtotalCents: number;
};

export type EnsurePodPayoutAllocationResult = {
  created: boolean;
  skipped: boolean;
};

/**
 * Idempotent: creates one PodPayoutAllocation per payment when pod payout settings qualify.
 * Call inside the same DB transaction as payment creation.
 */
export async function ensurePodPayoutAllocationForPaymentInTx(
  tx: Prisma.TransactionClient,
  input: EnsurePodPayoutAllocationInput
): Promise<EnsurePodPayoutAllocationResult> {
  const existing = await tx.podPayoutAllocation.findUnique({
    where: { paymentId: input.paymentId },
    select: { id: true },
  });
  if (existing) {
    return { created: false, skipped: false };
  }

  const settings = await tx.podPayoutSettings.findUnique({
    where: { podId: input.podId },
    select: {
      podPayoutsEnabled: true,
      podRevenueShareBps: true,
      podPayoutRecipientUserId: true,
    },
  });

  const decision = resolvePodPayoutAllocationDecision(input.eligibleSubtotalCents, settings);
  if (decision.action === "skip") {
    return { created: false, skipped: true };
  }

  await tx.podPayoutAllocation.create({
    data: {
      podId: input.podId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      eligibleSubtotalCents: decision.eligibleSubtotalCents,
      revenueShareBps: decision.revenueShareBps,
      podPayoutAmountCents: decision.podPayoutAmountCents,
      status: decision.status,
      blockedReason: decision.blockedReason,
      podPayoutRecipientUserId: decision.podPayoutRecipientUserId,
    },
  });

  return { created: true, skipped: false };
}
