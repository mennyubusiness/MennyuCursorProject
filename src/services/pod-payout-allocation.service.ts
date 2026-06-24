/**
 * Pod owner revenue share allocation at payment time (P1: records only — no Stripe transfers).
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  POD_PAYOUT_ALLOCATION_STATUS,
  resolveBlockedPodPayoutAllocationRepair,
  resolvePodPayoutAllocationDecision,
} from "@/lib/pod-payout-allocation";

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

export type AdminPodPayoutAllocationRow = {
  id: string;
  createdAt: Date;
  orderId: string;
  paymentId: string;
  eligibleSubtotalCents: number;
  revenueShareBps: number;
  podPayoutAmountCents: number;
  status: string;
  blockedReason: string | null;
  podPayoutRecipientUserId: string | null;
  recipientLabel: string | null;
};

const RECENT_ALLOCATIONS_TAKE = 50;

export async function listRecentPodPayoutAllocationsForAdmin(
  podId: string
): Promise<AdminPodPayoutAllocationRow[]> {
  const rows = await prisma.podPayoutAllocation.findMany({
    where: { podId },
    orderBy: { createdAt: "desc" },
    take: RECENT_ALLOCATIONS_TAKE,
    select: {
      id: true,
      createdAt: true,
      orderId: true,
      paymentId: true,
      eligibleSubtotalCents: true,
      revenueShareBps: true,
      podPayoutAmountCents: true,
      status: true,
      blockedReason: true,
      podPayoutRecipientUserId: true,
      podPayoutRecipientUser: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => {
    const user = row.podPayoutRecipientUser;
    const recipientLabel = user
      ? user.name?.trim()
        ? `${user.name.trim()} (${user.email})`
        : user.email
      : null;
    return {
      id: row.id,
      createdAt: row.createdAt,
      orderId: row.orderId,
      paymentId: row.paymentId,
      eligibleSubtotalCents: row.eligibleSubtotalCents,
      revenueShareBps: row.revenueShareBps,
      podPayoutAmountCents: row.podPayoutAmountCents,
      status: row.status,
      blockedReason: row.blockedReason,
      podPayoutRecipientUserId: row.podPayoutRecipientUserId,
      recipientLabel,
    };
  });
}

export type ReEvaluateBlockedPodPayoutAllocationsResult = {
  examined: number;
  repaired: number;
};

/**
 * Idempotent: promote repairable blocked allocations to pending when current settings qualify.
 * Only rows blocked for missing_recipient or invalid_bps are considered.
 */
export async function reEvaluateRepairableBlockedPodPayoutAllocations(
  podId: string
): Promise<ReEvaluateBlockedPodPayoutAllocationsResult> {
  const settings = await prisma.podPayoutSettings.findUnique({
    where: { podId },
    select: {
      podPayoutsEnabled: true,
      podRevenueShareBps: true,
      podPayoutRecipientUserId: true,
    },
  });

  const blocked = await prisma.podPayoutAllocation.findMany({
    where: {
      podId,
      status: POD_PAYOUT_ALLOCATION_STATUS.blocked,
    },
    select: {
      id: true,
      eligibleSubtotalCents: true,
      blockedReason: true,
    },
  });

  let repaired = 0;
  for (const row of blocked) {
    const repair = resolveBlockedPodPayoutAllocationRepair(
      row.eligibleSubtotalCents,
      row.blockedReason,
      settings
    );
    if (!repair.repair) continue;

    await prisma.podPayoutAllocation.update({
      where: { id: row.id },
      data: {
        status: repair.status,
        blockedReason: repair.blockedReason,
        revenueShareBps: repair.revenueShareBps,
        podPayoutAmountCents: repair.podPayoutAmountCents,
        podPayoutRecipientUserId: repair.podPayoutRecipientUserId,
      },
    });
    repaired++;
  }

  return { examined: blocked.length, repaired };
}
