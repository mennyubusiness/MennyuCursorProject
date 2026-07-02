import "server-only";

import { prisma } from "@/lib/db";
import {
  POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS,
  POD_PAYOUT_TRANSFER_STATUS,
  POD_PAYOUT_TRANSFER_STATUS_LABELS,
} from "@/lib/pod-payout-transfer-decision";
import type {
  AdminPodOption,
  AdminPodPayoutTransferRow,
  PodPayoutGlobalSummary,
} from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";

const DEFAULT_TAKE = 400;

function mapPodTransferRow(
  row: Awaited<ReturnType<typeof loadPodPayoutTransferRows>>[number]
): AdminPodPayoutTransferRow {
  const allocation = row.podPayoutAllocation;
  return {
    id: row.id,
    podId: row.podId,
    podName: row.pod.name,
    orderId: allocation.orderId,
    amountCents: row.amountCents,
    currency: row.currency,
    destinationAccountId: row.destinationAccountId,
    status: row.status,
    statusLabel: POD_PAYOUT_TRANSFER_STATUS_LABELS[row.status] ?? row.status,
    stripeTransferId: row.stripeTransferId,
    blockedReason: row.blockedReason,
    blockedReasonLabel: row.blockedReason
      ? POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS[row.blockedReason] ?? row.blockedReason
      : null,
    failureMessage: row.failureMessage,
    batchKey: row.batchKey,
    createdAt: row.createdAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    revenueShareBps: allocation.revenueShareBps,
    recipientEmail: allocation.podPayoutRecipientUser?.email ?? null,
    recipientUserId: allocation.podPayoutRecipientUserId,
  };
}

async function loadPodPayoutTransferRows(take: number) {
  return prisma.podPayoutTransfer.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      pod: { select: { id: true, name: true } },
      podPayoutAllocation: {
        select: {
          orderId: true,
          revenueShareBps: true,
          podPayoutRecipientUserId: true,
          podPayoutRecipientUser: { select: { id: true, email: true } },
        },
      },
    },
  });
}

export function computePodPayoutGlobalSummary(
  transfers: AdminPodPayoutTransferRow[]
): PodPayoutGlobalSummary {
  let needsActionCount = 0;
  let needsActionAmountCents = 0;
  let readyToTransferCount = 0;
  let readyToTransferAmountCents = 0;
  let blockedCount = 0;
  let blockedAmountCents = 0;
  let paidCount = 0;
  let paidAmountCents = 0;

  for (const row of transfers) {
    if (row.status === POD_PAYOUT_TRANSFER_STATUS.paid) {
      paidCount++;
      paidAmountCents += row.amountCents;
      continue;
    }
    if (row.status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
      continue;
    }
    if (row.status === POD_PAYOUT_TRANSFER_STATUS.pending) {
      readyToTransferCount++;
      readyToTransferAmountCents += row.amountCents;
      needsActionCount++;
      needsActionAmountCents += row.amountCents;
      continue;
    }
    if (
      row.status === POD_PAYOUT_TRANSFER_STATUS.submitted ||
      row.status === POD_PAYOUT_TRANSFER_STATUS.failed ||
      row.status.startsWith("blocked")
    ) {
      blockedCount++;
      blockedAmountCents += row.amountCents;
      needsActionCount++;
      needsActionAmountCents += row.amountCents;
    }
  }

  return {
    needsActionCount,
    needsActionAmountCents,
    readyToTransferCount,
    readyToTransferAmountCents,
    blockedCount,
    blockedAmountCents,
    paidCount,
    paidAmountCents,
  };
}

export async function listPodPayoutTransfersForAdminDashboard(
  take = DEFAULT_TAKE
): Promise<{
  transfers: AdminPodPayoutTransferRow[];
  pods: AdminPodOption[];
  summary: PodPayoutGlobalSummary;
}> {
  const [rows, pods] = await Promise.all([
    loadPodPayoutTransferRows(take),
    prisma.pod.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const transfers = rows.map(mapPodTransferRow);
  return {
    transfers,
    pods,
    summary: computePodPayoutGlobalSummary(transfers),
  };
}
