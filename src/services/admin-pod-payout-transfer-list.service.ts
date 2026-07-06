import "server-only";

import { prisma } from "@/lib/db";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS,
  POD_PAYOUT_TRANSFER_STATUS,
  POD_PAYOUT_TRANSFER_STATUS_LABELS,
} from "@/lib/pod-payout-transfer-decision";
import type {
  AdminPodOption,
  AdminPodPayoutReadinessRow,
  AdminPodPayoutTransferRow,
  PodPayoutGlobalSummary,
} from "@/app/admin/(dashboard)/payout-transfers/payout-transfers-admin.types";
import { syncStalePaidPodPayoutAllocationStatusesGlobal } from "@/services/pod-payout-allocation.service";
import {
  computePodPayoutTransferAdminSummaryFromData,
  podPayoutTransferAdminSummaryAllocationSelect,
  type PodPayoutTransferAdminSummary,
} from "@/services/pod-payout-transfer.service";

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

export function aggregatePodPayoutGlobalSummary(
  podSummaries: PodPayoutTransferAdminSummary[]
): PodPayoutGlobalSummary {
  let pendingAllocationCount = 0;
  let pendingAllocationAmountCents = 0;
  let readyToBatchCount = 0;
  let readyToBatchAmountCents = 0;
  let readyToBatchPodCount = 0;
  let blockedAllocationCount = 0;
  let blockedAllocationAmountCents = 0;
  let blockedTransferCount = 0;
  let blockedTransferAmountCents = 0;
  let paidCount = 0;
  let paidAmountCents = 0;

  for (const summary of podSummaries) {
    pendingAllocationCount += summary.pendingAllocationCount;
    pendingAllocationAmountCents += summary.pendingAllocationAmountCents;
    readyToBatchCount += summary.transferableCount;
    readyToBatchAmountCents += summary.transferableAmountCents;
    if (summary.canRunPayoutBatch) {
      readyToBatchPodCount++;
    }

    for (const allocation of summary.nonTransferableAllocations) {
      blockedAllocationCount++;
      blockedAllocationAmountCents += allocation.amountCents;
    }

    blockedTransferCount += summary.blockedTransferCount;
    blockedTransferAmountCents += summary.blockedTransferAmountCents;
    paidCount += summary.paidTransferCount;
    paidAmountCents += summary.paidTransferAmountCents;
  }

  const blockedCount = blockedAllocationCount + blockedTransferCount;
  const blockedAmountCents = blockedAllocationAmountCents + blockedTransferAmountCents;
  const needsActionCount = readyToBatchCount + blockedCount;
  const needsActionAmountCents = readyToBatchAmountCents + blockedAmountCents;

  return {
    pendingAllocationCount,
    pendingAllocationAmountCents,
    readyToBatchCount,
    readyToBatchAmountCents,
    readyToBatchPodCount,
    readyToTransferCount: readyToBatchCount,
    readyToTransferAmountCents: readyToBatchAmountCents,
    blockedCount,
    blockedAmountCents,
    paidCount,
    paidAmountCents,
    needsActionCount,
    needsActionAmountCents,
  };
}

export function buildAdminPodPayoutReadinessRow(
  podId: string,
  podName: string,
  summary: PodPayoutTransferAdminSummary
): AdminPodPayoutReadinessRow | null {
  const hasActivity =
    summary.pendingAllocationCount > 0 ||
    summary.blockedTransferCount > 0 ||
    summary.paidTransferCount > 0 ||
    summary.canRunPayoutBatch;

  if (!hasActivity) {
    return null;
  }

  const waitingAllocations = summary.nonTransferableAllocations.filter(
    (row) => row.reason === "waiting_on_vendor_transfer"
  );
  const blockedAllocations = summary.nonTransferableAllocations.filter(
    (row) => row.reason !== "waiting_on_vendor_transfer"
  );

  const topBlockerReasonLabel =
    blockedAllocations[0]?.reasonLabel ??
    (summary.blockedTransferCount > 0 ? "Blocked transfer row" : null);

  return {
    podId,
    podName,
    pendingAllocationCount: summary.pendingAllocationCount,
    pendingAllocationAmountCents: summary.pendingAllocationAmountCents,
    readyToBatchAmountCents: summary.transferableAmountCents,
    readyToBatchCount: summary.transferableCount,
    canRunPayoutBatch: summary.canRunPayoutBatch,
    blockedAllocationCount: blockedAllocations.length,
    blockedAllocationAmountCents: blockedAllocations.reduce((sum, row) => sum + row.amountCents, 0),
    blockedTransferCount: summary.blockedTransferCount,
    blockedTransferAmountCents: summary.blockedTransferAmountCents,
    paidTransferCount: summary.paidTransferCount,
    paidTransferAmountCents: summary.paidTransferAmountCents,
    waitingOnVendorCount: waitingAllocations.length,
    waitingOnVendorAmountCents: waitingAllocations.reduce((sum, row) => sum + row.amountCents, 0),
    topBlockerReasonLabel,
  };
}

/** @deprecated Use aggregatePodPayoutGlobalSummary with allocation-level pod summaries. */
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
    pendingAllocationCount: 0,
    pendingAllocationAmountCents: 0,
    readyToBatchCount: readyToTransferCount,
    readyToBatchAmountCents: readyToTransferAmountCents,
    readyToBatchPodCount: 0,
    readyToTransferCount,
    readyToTransferAmountCents,
    blockedCount,
    blockedAmountCents,
    paidCount,
    paidAmountCents,
    needsActionCount,
    needsActionAmountCents,
  };
}

async function loadPodPayoutReadinessSummaries(): Promise<{
  summariesByPodId: Map<string, PodPayoutTransferAdminSummary>;
  podNamesById: Map<string, string>;
}> {
  await syncStalePaidPodPayoutAllocationStatusesGlobal();

  const [pendingAllocations, settingsRows, transferRows, pods] = await Promise.all([
    prisma.podPayoutAllocation.findMany({
      where: { status: POD_PAYOUT_ALLOCATION_STATUS.pending },
      select: {
        podId: true,
        ...podPayoutTransferAdminSummaryAllocationSelect,
      },
    }),
    prisma.podPayoutSettings.findMany({
      select: { podId: true, minimumPayoutCents: true },
    }),
    prisma.podPayoutTransfer.findMany({
      select: { podId: true, status: true, amountCents: true },
    }),
    prisma.pod.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const minimumByPodId = new Map(settingsRows.map((row) => [row.podId, row.minimumPayoutCents]));
  const podNamesById = new Map(pods.map((pod) => [pod.id, pod.name]));
  const allocationsByPodId = new Map<string, typeof pendingAllocations>();
  const transfersByPodId = new Map<string, Array<{ status: string; amountCents: number }>>();

  for (const allocation of pendingAllocations) {
    const list = allocationsByPodId.get(allocation.podId) ?? [];
    list.push(allocation);
    allocationsByPodId.set(allocation.podId, list);
  }

  for (const transfer of transferRows) {
    const list = transfersByPodId.get(transfer.podId) ?? [];
    list.push({ status: transfer.status, amountCents: transfer.amountCents });
    transfersByPodId.set(transfer.podId, list);
  }

  const podIds = new Set<string>([
    ...allocationsByPodId.keys(),
    ...transfersByPodId.keys(),
  ]);

  const summariesByPodId = new Map<string, PodPayoutTransferAdminSummary>();
  for (const podId of podIds) {
    summariesByPodId.set(
      podId,
      computePodPayoutTransferAdminSummaryFromData({
        minimumPayoutCents: minimumByPodId.get(podId) ?? 0,
        pendingAllocations: allocationsByPodId.get(podId) ?? [],
        transfers: transfersByPodId.get(podId) ?? [],
      })
    );
  }

  return { summariesByPodId, podNamesById };
}

export async function listPodPayoutTransfersForAdminDashboard(
  take = DEFAULT_TAKE
): Promise<{
  transfers: AdminPodPayoutTransferRow[];
  pods: AdminPodOption[];
  summary: PodPayoutGlobalSummary;
  readiness: AdminPodPayoutReadinessRow[];
}> {
  const [{ summariesByPodId, podNamesById }, rows, pods] = await Promise.all([
    loadPodPayoutReadinessSummaries(),
    loadPodPayoutTransferRows(take),
    prisma.pod.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const podSummaries = [...summariesByPodId.values()];
  const summary = aggregatePodPayoutGlobalSummary(podSummaries);

  const readiness = [...summariesByPodId.entries()]
    .map(([podId, podSummary]) =>
      buildAdminPodPayoutReadinessRow(podId, podNamesById.get(podId) ?? podId, podSummary)
    )
    .filter((row): row is AdminPodPayoutReadinessRow => row !== null)
    .sort((a, b) => {
      if (a.canRunPayoutBatch !== b.canRunPayoutBatch) {
        return a.canRunPayoutBatch ? -1 : 1;
      }
      return b.readyToBatchAmountCents - a.readyToBatchAmountCents;
    });

  return {
    transfers: rows.map(mapPodTransferRow),
    pods,
    summary,
    readiness,
  };
}
