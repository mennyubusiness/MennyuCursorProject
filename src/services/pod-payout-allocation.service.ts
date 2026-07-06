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
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

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
  podPayoutTransferId: string | null;
  podPayoutTransferStatus: string | null;
  stripeTransferId: string | null;
  transferPaidAt: Date | null;
};

const RECENT_ALLOCATIONS_TAKE = 50;

type AllocationDbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Marks a pending allocation paid after its pod payout transfer settles.
 * Does not overwrite refund-blocked, cancelled, or blocked allocation statuses.
 */
export async function markPodPayoutAllocationPaidForTransfer(
  podPayoutAllocationId: string,
  db: AllocationDbClient = prisma
): Promise<boolean> {
  const result = await db.podPayoutAllocation.updateMany({
    where: {
      id: podPayoutAllocationId,
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
    },
    data: {
      status: POD_PAYOUT_ALLOCATION_STATUS.paid,
    },
  });
  return result.count > 0;
}

/**
 * Repairs allocations left pending after their linked transfer row was paid (legacy rows).
 */
export async function syncStalePaidPodPayoutAllocationStatusesForPod(
  podId: string
): Promise<number> {
  const stale = await prisma.podPayoutAllocation.findMany({
    where: {
      podId,
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutTransfer: { status: POD_PAYOUT_TRANSFER_STATUS.paid },
    },
    select: { id: true },
  });
  if (stale.length === 0) return 0;

  const result = await prisma.podPayoutAllocation.updateMany({
    where: {
      id: { in: stale.map((row) => row.id) },
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
    },
    data: { status: POD_PAYOUT_ALLOCATION_STATUS.paid },
  });
  return result.count;
}

export async function syncStalePaidPodPayoutAllocationStatusesGlobal(): Promise<number> {
  const stale = await prisma.podPayoutAllocation.findMany({
    where: {
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutTransfer: { status: POD_PAYOUT_TRANSFER_STATUS.paid },
    },
    select: { id: true },
    take: 500,
  });
  if (stale.length === 0) return 0;

  const result = await prisma.podPayoutAllocation.updateMany({
    where: {
      id: { in: stale.map((row) => row.id) },
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
    },
    data: { status: POD_PAYOUT_ALLOCATION_STATUS.paid },
  });
  return result.count;
}

export async function listRecentPodPayoutAllocationsForAdmin(
  podId: string
): Promise<AdminPodPayoutAllocationRow[]> {
  await syncStalePaidPodPayoutAllocationStatusesForPod(podId);

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
      podPayoutTransfer: {
        select: {
          id: true,
          status: true,
          stripeTransferId: true,
          paidAt: true,
        },
      },
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
      podPayoutTransferId: row.podPayoutTransfer?.id ?? null,
      podPayoutTransferStatus: row.podPayoutTransfer?.status ?? null,
      stripeTransferId: row.podPayoutTransfer?.stripeTransferId ?? null,
      transferPaidAt: row.podPayoutTransfer?.paidAt ?? null,
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
