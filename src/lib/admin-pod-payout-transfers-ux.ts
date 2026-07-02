/**
 * Pod payout transfer row classification for admin Payouts page (presentation only).
 */
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export type PodPayoutTransferRowLike = {
  id: string;
  podId: string;
  podName: string;
  status: string;
  amountCents: number;
  createdAt: string;
  blockedReason: string | null;
  blockedReasonLabel: string | null;
  failureMessage: string | null;
  destinationAccountId: string | null;
};

export type PodPayoutQuickFilter = "default" | "needs_action" | "ready" | "blocked" | "sent" | "all";

export function podTransferIsCancelled(row: PodPayoutTransferRowLike): boolean {
  return row.status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund;
}

export function podTransferIsPaid(row: PodPayoutTransferRowLike): boolean {
  return row.status === POD_PAYOUT_TRANSFER_STATUS.paid;
}

export function podTransferIsReady(row: PodPayoutTransferRowLike): boolean {
  return row.status === POD_PAYOUT_TRANSFER_STATUS.pending;
}

export function podTransferIsBlocked(row: PodPayoutTransferRowLike): boolean {
  if (podTransferIsCancelled(row) || podTransferIsPaid(row)) return false;
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.pending) return false;
  return (
    row.status.startsWith("blocked") ||
    row.status === POD_PAYOUT_TRANSFER_STATUS.failed ||
    row.destinationAccountId === "blocked"
  );
}

export function podTransferNeedsAction(row: PodPayoutTransferRowLike): boolean {
  if (podTransferIsCancelled(row) || podTransferIsPaid(row)) return false;
  return podTransferIsReady(row) || podTransferIsBlocked(row);
}

export function podStatusFilterBucket(
  status: string
): "pending" | "paid" | "failed" | "blocked" {
  if (status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) return "blocked";
  if (status.startsWith("blocked") || status === POD_PAYOUT_TRANSFER_STATUS.blocked) return "blocked";
  if (status === POD_PAYOUT_TRANSFER_STATUS.failed) return "failed";
  if (status === POD_PAYOUT_TRANSFER_STATUS.paid) return "paid";
  if (status === POD_PAYOUT_TRANSFER_STATUS.pending || status === POD_PAYOUT_TRANSFER_STATUS.submitted) {
    return "pending";
  }
  return "pending";
}

export function podTransferProblemLabel(row: PodPayoutTransferRowLike): string {
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.pending) return "Ready to send";
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance) {
    return "Insufficient Stripe balance";
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch) {
    return "Idempotency mismatch";
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview) {
    return "Partial refund review";
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady) {
    return "Payout account not ready";
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum) {
    return "Below minimum payout";
  }
  if (row.status === POD_PAYOUT_TRANSFER_STATUS.failed) return "Transfer failed";
  if (row.blockedReasonLabel) return row.blockedReasonLabel;
  if (row.destinationAccountId === "blocked") return "Payout account blocked";
  return "Needs attention";
}

export function podTransferMatchesQuickFilter(
  row: PodPayoutTransferRowLike,
  filter: PodPayoutQuickFilter
): boolean {
  if (filter === "all" || filter === "default") return true;
  if (filter === "needs_action") return podTransferNeedsAction(row);
  if (filter === "ready") return podTransferIsReady(row);
  if (filter === "blocked") return podTransferIsBlocked(row);
  if (filter === "sent") return podTransferIsPaid(row);
  return true;
}

export function formatRevenueShareBps(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}
