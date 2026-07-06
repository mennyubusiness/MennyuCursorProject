/**
 * Pod payout batch skip reason normalization (pure; shared by service + admin UI).
 */
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export const POD_PAYOUT_TRANSFER_SKIP_REASON_KEYS = [
  "waiting_on_vendor_transfer",
  "connect_not_ready",
  "refund_review",
  "cancelled_due_to_refund",
  "insufficient_balance",
  "balance_unavailable",
  "invalid_destination",
  "already_paid",
  "not_pending",
  "below_minimum",
  "idempotency_mismatch",
  "not_found",
  "unknown_skip",
] as const;

export type PodPayoutTransferSkipReasonKey =
  (typeof POD_PAYOUT_TRANSFER_SKIP_REASON_KEYS)[number];

export const POD_PAYOUT_TRANSFER_SKIP_REASON_LABELS: Record<
  PodPayoutTransferSkipReasonKey,
  string
> = {
  waiting_on_vendor_transfer: "Waiting on vendor transfer",
  connect_not_ready: "Payout account not ready",
  refund_review: "Needs refund review",
  cancelled_due_to_refund: "Cancelled due to refund",
  insufficient_balance: "Insufficient Stripe balance",
  balance_unavailable: "Stripe balance unavailable",
  invalid_destination: "Invalid destination account",
  already_paid: "Already paid",
  not_pending: "Transfer row not pending",
  below_minimum: "Below minimum payout",
  idempotency_mismatch: "Idempotency mismatch",
  not_found: "Transfer row not found",
  unknown_skip: "Unknown skip",
};

export function createEmptyPodPayoutTransferSkipReasonCounts(): Record<
  PodPayoutTransferSkipReasonKey,
  number
> {
  return Object.fromEntries(
    POD_PAYOUT_TRANSFER_SKIP_REASON_KEYS.map((key) => [key, 0])
  ) as Record<PodPayoutTransferSkipReasonKey, number>;
}

export function normalizePodPayoutTransferSkipReason(
  reason: string
): PodPayoutTransferSkipReasonKey {
  switch (reason) {
    case "waiting_on_vendor_transfer":
    case "no_vendor_allocations":
      return "waiting_on_vendor_transfer";
    case "connect_not_ready":
    case POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady:
      return "connect_not_ready";
    case "refund_review":
    case POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview:
      return "refund_review";
    case POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund:
      return "cancelled_due_to_refund";
    case POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance:
    case "blocked_insufficient_balance":
      return "insufficient_balance";
    case "blocked_balance_unavailable":
      return "balance_unavailable";
    case "missing_destination":
    case "blocked_destination":
    case "invalid_destination":
      return "invalid_destination";
    case "already_paid":
      return "already_paid";
    case "allocation_not_pending":
    case "existing_transfer_blocked":
    case "not_retryable_status_submitted":
      return "not_pending";
    case POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum:
    case "below_minimum":
      return "below_minimum";
    case POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch:
    case "blocked_idempotency_mismatch":
      return "idempotency_mismatch";
    case "not_found":
      return "not_found";
    default:
      if (reason.startsWith("status_")) {
        const status = reason.slice("status_".length);
        if (status === POD_PAYOUT_TRANSFER_STATUS.pending) return "unknown_skip";
        return normalizePodPayoutTransferSkipReason(status);
      }
      if (reason.startsWith("not_retryable_status_")) {
        return normalizePodPayoutTransferSkipReason(reason.slice("not_retryable_status_".length));
      }
      return "unknown_skip";
  }
}

export function formatPodPayoutTransferBatchSkipSummary(input: {
  skipReasonCounts: Record<PodPayoutTransferSkipReasonKey, number>;
}): string {
  const parts = POD_PAYOUT_TRANSFER_SKIP_REASON_KEYS.filter(
    (key) => input.skipReasonCounts[key] > 0
  ).map((key) => `${POD_PAYOUT_TRANSFER_SKIP_REASON_LABELS[key]}: ${input.skipReasonCounts[key]}`);

  return parts.length > 0 ? parts.join("; ") : "";
}

export type PodPayoutTransferBatchSummaryLike = {
  batchKey: string;
  rowsCreated: number;
  examined: number;
  settled: number;
  skipped: number;
  failed: number;
  blockedInsufficientBalance: number;
  stoppedEarlyForBalance: boolean;
  skipReasonCounts?: Record<PodPayoutTransferSkipReasonKey, number>;
};

export function formatPodPayoutTransferBatchResultMessage(
  summary: PodPayoutTransferBatchSummaryLike
): string {
  const skipDetail = summary.skipReasonCounts
    ? formatPodPayoutTransferBatchSkipSummary({ skipReasonCounts: summary.skipReasonCounts })
    : "";

  let message =
    `Batch ${summary.batchKey}: created ${summary.rowsCreated} transfer row(s), ` +
    `examined ${summary.examined}, settled ${summary.settled}, skipped ${summary.skipped}, failed ${summary.failed}.`;

  if (summary.blockedInsufficientBalance > 0) {
    message += ` Blocked for balance: ${summary.blockedInsufficientBalance}.`;
  }
  if (summary.stoppedEarlyForBalance) {
    message += " Stopped early due to insufficient Stripe balance.";
  }
  if (skipDetail) {
    message += ` Skip reasons: ${skipDetail}.`;
  }

  return message;
}
