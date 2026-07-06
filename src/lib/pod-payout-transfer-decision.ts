/**
 * Pure decision logic for pod payout transfer row creation (batch time).
 */
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  resolvePodPayoutTransferRefundBlock,
  type PaymentRefundStatusForPodTransfer,
} from "@/lib/pod-payout-transfer-refund-eligibility";

export const POD_PAYOUT_TRANSFER_STATUS = {
  pending: "pending",
  blocked: "blocked",
  blockedInsufficientBalance: "blocked_insufficient_balance",
  blockedConnectNotReady: "blocked_connect_not_ready",
  blockedBelowMinimum: "blocked_below_minimum",
  blockedPartialRefundReview: "blocked_partial_refund_review",
  cancelledDueToRefund: "cancelled_due_to_refund",
  submitted: "submitted",
  paid: "paid",
  failed: "failed",
  blockedIdempotencyMismatch: "blocked_idempotency_mismatch",
} as const;

export type PodPayoutTransferStatus =
  (typeof POD_PAYOUT_TRANSFER_STATUS)[keyof typeof POD_PAYOUT_TRANSFER_STATUS];

export const POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION = "blocked" as const;

export const POD_PAYOUT_TRANSFER_BLOCKED_REASON = {
  belowMinimum: "below_minimum_payout_threshold",
  connectAccountMissing: "stripe_connect_account_missing",
  connectDetailsNotSubmitted: "stripe_details_not_submitted",
  connectPayoutsNotEnabled: "stripe_payouts_not_enabled",
} as const;

export function stablePodPayoutTransferIdempotencyKey(podPayoutAllocationId: string): string {
  return `openorder_ppt_${podPayoutAllocationId}`;
}

export type PodPayoutConnectTransferFields = {
  podPayoutStripeConnectedAccountId: string | null;
  podPayoutStripeDetailsSubmitted: boolean;
  podPayoutStripePayoutsEnabled: boolean;
};

export function isPodPayoutConnectTransferReady(user: PodPayoutConnectTransferFields): boolean {
  return Boolean(
    user.podPayoutStripeConnectedAccountId?.trim() &&
      user.podPayoutStripeDetailsSubmitted &&
      user.podPayoutStripePayoutsEnabled
  );
}

/** Transfer rows in these statuses are not blocked for admin summary totals. */
export function isPodPayoutTransferBlockedSummaryStatus(status: string): boolean {
  return (
    status !== POD_PAYOUT_TRANSFER_STATUS.paid &&
    status !== POD_PAYOUT_TRANSFER_STATUS.pending &&
    status !== POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund
  );
}

export function blockedReasonForPodPayoutConnect(user: PodPayoutConnectTransferFields): string {
  if (!user.podPayoutStripeConnectedAccountId?.trim()) {
    return POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectAccountMissing;
  }
  if (!user.podPayoutStripeDetailsSubmitted) {
    return POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectDetailsNotSubmitted;
  }
  if (!user.podPayoutStripePayoutsEnabled) {
    return POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectPayoutsNotEnabled;
  }
  return POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectAccountMissing;
}

export type PodPayoutTransferEnsureInput = {
  allocationStatus: string;
  podPayoutAmountCents: number;
  minimumPayoutCents: number;
  paymentRefundStatus: PaymentRefundStatusForPodTransfer;
  recipientConnect: PodPayoutConnectTransferFields | null;
};

export type PodPayoutTransferEnsureDecision = {
  status: PodPayoutTransferStatus;
  destinationAccountId: string;
  amountCents: number;
  blockedReason: string | null;
};

/**
 * Returns null when no transfer row should be created (non-pending allocation).
 */
export function resolvePodPayoutTransferEnsureDecision(
  input: PodPayoutTransferEnsureInput
): PodPayoutTransferEnsureDecision | null {
  if (input.allocationStatus !== POD_PAYOUT_ALLOCATION_STATUS.pending) {
    return null;
  }

  const amountCents = input.podPayoutAmountCents;
  const refundBlock = resolvePodPayoutTransferRefundBlock(input.paymentRefundStatus);
  if (refundBlock.block) {
    return {
      status: refundBlock.status,
      destinationAccountId: POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION,
      amountCents,
      blockedReason: refundBlock.blockedReason,
    };
  }

  if (input.minimumPayoutCents > 0 && amountCents < input.minimumPayoutCents) {
    return {
      status: POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum,
      destinationAccountId: POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION,
      amountCents,
      blockedReason: POD_PAYOUT_TRANSFER_BLOCKED_REASON.belowMinimum,
    };
  }

  const connect = input.recipientConnect;
  if (!connect || !isPodPayoutConnectTransferReady(connect)) {
    return {
      status: POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
      destinationAccountId: POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION,
      amountCents,
      blockedReason: connect ? blockedReasonForPodPayoutConnect(connect) : POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectAccountMissing,
    };
  }

  return {
    status: POD_PAYOUT_TRANSFER_STATUS.pending,
    destinationAccountId: connect.podPayoutStripeConnectedAccountId!.trim(),
    amountCents,
    blockedReason: null,
  };
}

export const POD_PAYOUT_TRANSFER_STATUS_LABELS: Record<string, string> = {
  [POD_PAYOUT_TRANSFER_STATUS.pending]: "Pending",
  [POD_PAYOUT_TRANSFER_STATUS.blocked]: "Blocked",
  [POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance]: "Insufficient balance",
  [POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady]: "Payout account not ready",
  [POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum]: "Below minimum payout",
  [POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview]: "Needs review",
  [POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund]: "Cancelled after refund",
  [POD_PAYOUT_TRANSFER_STATUS.submitted]: "Submitted",
  [POD_PAYOUT_TRANSFER_STATUS.paid]: "Paid",
  [POD_PAYOUT_TRANSFER_STATUS.failed]: "Failed",
  [POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch]: "Idempotency mismatch",
};

export const POD_PAYOUT_TRANSFER_BLOCKED_REASON_LABELS: Record<string, string> = {
  [POD_PAYOUT_TRANSFER_BLOCKED_REASON.belowMinimum]: "Allocation is below the pod minimum payout threshold",
  [POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectAccountMissing]: "Payout account owner has no Stripe Connect account",
  [POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectDetailsNotSubmitted]: "Payout account onboarding is incomplete",
  [POD_PAYOUT_TRANSFER_BLOCKED_REASON.connectPayoutsNotEnabled]: "Stripe payouts are not enabled for the payout account",
  customer_refund_extinguished_obligation: "Customer refund — pod payout no longer payable",
  partial_refund_manual_review: "Partial or pending refund — admin review required before transfer",
};
