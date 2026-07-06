/**
 * Pure aggregation for pod-owner payout visibility (no DB / vendor math).
 */
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";
import { isSentPodPayoutTransfer } from "@/lib/pod-payout-transfer-refund-eligibility";

export type PodOwnerPayoutAllocationRow = {
  status: string;
  podPayoutAmountCents: number;
  eligibleSubtotalCents?: number;
};

export type PodOwnerPayoutTransferRow = {
  id?: string;
  status: string;
  amountCents: number;
  blockedReason?: string | null;
  createdAt: Date;
  paidAt?: Date | null;
  submittedAt?: Date | null;
};

export type PodOwnerPayoutTotals = {
  pendingAllocationAmountCents: number;
  pendingAllocationCount: number;
  blockedAmountCents: number;
  blockedCount: number;
  cancelledAmountCents: number;
  cancelledCount: number;
  sentAmountCents: number;
  sentCount: number;
  needsReviewCount: number;
};

const BLOCKED_TRANSFER_STATUSES = new Set<string>([
  POD_PAYOUT_TRANSFER_STATUS.blocked,
  POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
  POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
  POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum,
  POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
  POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
  POD_PAYOUT_TRANSFER_STATUS.failed,
]);

function isAllocationNeedsReview(status: string): boolean {
  return (
    status === POD_PAYOUT_ALLOCATION_STATUS.blocked ||
    status === POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview
  );
}

export function aggregateEligibleSalesCents(
  allocations: Array<{ status: string; eligibleSubtotalCents: number }>
): number {
  return allocations
    .filter((row) => row.status !== POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund)
    .reduce((sum, row) => sum + row.eligibleSubtotalCents, 0);
}

export function aggregatePodRevenueShareCents(allocations: PodOwnerPayoutAllocationRow[]): number {
  return allocations
    .filter((row) => row.status !== POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund)
    .reduce((sum, row) => sum + row.podPayoutAmountCents, 0);
}

export function aggregatePodOwnerPayoutTotals(
  allocations: PodOwnerPayoutAllocationRow[],
  transfers: PodOwnerPayoutTransferRow[]
): PodOwnerPayoutTotals {
  const totals: PodOwnerPayoutTotals = {
    pendingAllocationAmountCents: 0,
    pendingAllocationCount: 0,
    blockedAmountCents: 0,
    blockedCount: 0,
    cancelledAmountCents: 0,
    cancelledCount: 0,
    sentAmountCents: 0,
    sentCount: 0,
    needsReviewCount: 0,
  };

  for (const row of allocations) {
    if (row.status === POD_PAYOUT_ALLOCATION_STATUS.paid) {
      continue;
    }
    if (row.status === POD_PAYOUT_ALLOCATION_STATUS.pending) {
      totals.pendingAllocationAmountCents += row.podPayoutAmountCents;
      totals.pendingAllocationCount++;
      continue;
    }
    if (row.status === POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund) {
      totals.cancelledAmountCents += row.podPayoutAmountCents;
      totals.cancelledCount++;
      continue;
    }
    if (isAllocationNeedsReview(row.status)) {
      totals.blockedAmountCents += row.podPayoutAmountCents;
      totals.blockedCount++;
      totals.needsReviewCount++;
    }
  }

  for (const row of transfers) {
    if (isSentPodPayoutTransfer(row)) {
      totals.sentAmountCents += row.amountCents;
      totals.sentCount++;
      continue;
    }
    if (row.status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
      totals.cancelledAmountCents += row.amountCents;
      totals.cancelledCount++;
      continue;
    }
    if (BLOCKED_TRANSFER_STATUSES.has(row.status)) {
      totals.blockedAmountCents += row.amountCents;
      totals.blockedCount++;
      totals.needsReviewCount++;
    }
  }

  return totals;
}

export function ownerPayoutHistoryStatusLabel(status: string): string {
  if (
    status === POD_PAYOUT_TRANSFER_STATUS.paid ||
    status === POD_PAYOUT_TRANSFER_STATUS.submitted
  ) {
    return "Paid";
  }
  if (status === POD_PAYOUT_TRANSFER_STATUS.pending) {
    return "Pending";
  }
  if (status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
    return "Cancelled";
  }
  if (status === POD_PAYOUT_TRANSFER_STATUS.failed) {
    return "Failed";
  }
  if (
    status === POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview ||
    BLOCKED_TRANSFER_STATUSES.has(status)
  ) {
    return "Needs review";
  }
  return "Needs review";
}

export function ownerTransferStatusLabel(status: string): string {
  if (
    status === POD_PAYOUT_TRANSFER_STATUS.paid ||
    status === POD_PAYOUT_TRANSFER_STATUS.submitted
  ) {
    return "Transfer sent";
  }
  if (status === POD_PAYOUT_TRANSFER_STATUS.pending) {
    return "Pending";
  }
  if (status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
    return "Cancelled after refund";
  }
  if (
    status === POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview ||
    status === POD_PAYOUT_TRANSFER_STATUS.failed ||
    BLOCKED_TRANSFER_STATUSES.has(status)
  ) {
    return "Needs review";
  }
  return "Needs review";
}

export function pickLastSentTransfer(
  transfers: PodOwnerPayoutTransferRow[]
): PodOwnerPayoutTransferRow | null {
  const sent = transfers.filter((row) => isSentPodPayoutTransfer(row));
  if (sent.length === 0) return null;

  return sent.reduce((latest, row) => {
    const rowDate = row.paidAt ?? row.submittedAt ?? row.createdAt;
    const latestDate = latest.paidAt ?? latest.submittedAt ?? latest.createdAt;
    return rowDate.getTime() >= latestDate.getTime() ? row : latest;
  });
}

export function buildOwnerPayoutHistory(
  transfers: PodOwnerPayoutTransferRow[]
): Array<{ id: string; date: Date; amountCents: number; statusLabel: string }> {
  return transfers
    .slice()
    .sort((a, b) => {
      const dateA = (a.paidAt ?? a.submittedAt ?? a.createdAt).getTime();
      const dateB = (b.paidAt ?? b.submittedAt ?? b.createdAt).getTime();
      return dateB - dateA;
    })
    .map((row, index) => ({
      id: row.id ?? `${row.createdAt.getTime()}-${index}`,
      date: row.paidAt ?? row.submittedAt ?? row.createdAt,
      amountCents: row.amountCents,
      statusLabel: ownerPayoutHistoryStatusLabel(row.status),
    }));
}

export function buildRecentOwnerTransfers(
  transfers: PodOwnerPayoutTransferRow[],
  limit = 5
): Array<{ id: string; date: Date; amountCents: number; statusLabel: string }> {
  return transfers
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((row, index) => ({
      id: row.id ?? `${row.createdAt.getTime()}-${index}`,
      date: row.paidAt ?? row.submittedAt ?? row.createdAt,
      amountCents: row.amountCents,
      statusLabel: ownerTransferStatusLabel(row.status),
    }));
}
