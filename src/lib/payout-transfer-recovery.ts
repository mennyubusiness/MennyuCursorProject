/**
 * Shared payout transfer recovery constants (vendor + pod).
 */
import { IDEMPOTENCY_MISMATCH_STATUS, INSUFFICIENT_BALANCE_STATUS } from "@/lib/vendor-payout-transfer-failure";
import {
  CANCELLED_DUE_TO_REFUND_STATUS,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export const VENDOR_REEVALUATE_TRANSFER_STATUSES = [
  "blocked",
  INSUFFICIENT_BALANCE_STATUS,
] as const;

export const POD_REEVALUATE_TRANSFER_STATUSES = [
  POD_PAYOUT_TRANSFER_STATUS.blocked,
  POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
  POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum,
  POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
] as const;

/** Statuses that block vendor/pod deletion while money may still be owed or recoverable. */
export const BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES = [
  "pending",
  "blocked",
  "submitted",
  INSUFFICIENT_BALANCE_STATUS,
  "failed",
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
  IDEMPOTENCY_MISMATCH_STATUS,
] as const;

export const BLOCKING_POD_PAYOUT_TRANSFER_STATUSES = [
  POD_PAYOUT_TRANSFER_STATUS.pending,
  POD_PAYOUT_TRANSFER_STATUS.blocked,
  POD_PAYOUT_TRANSFER_STATUS.submitted,
  POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
  POD_PAYOUT_TRANSFER_STATUS.failed,
  POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
  POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum,
  POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
  POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
] as const;

export type PayoutReEvaluateSummary = {
  examined: number;
  promotedToPending: number;
  updatedBlocked: number;
  unchanged: number;
  skippedTerminal: number;
};

export function emptyReEvaluateSummary(): PayoutReEvaluateSummary {
  return {
    examined: 0,
    promotedToPending: 0,
    updatedBlocked: 0,
    unchanged: 0,
    skippedTerminal: 0,
  };
}

export function isBlockingVendorPayoutTransferStatus(status: string): boolean {
  return (BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES as readonly string[]).includes(status);
}

export function isBlockingPodPayoutTransferStatus(status: string): boolean {
  return (BLOCKING_POD_PAYOUT_TRANSFER_STATUSES as readonly string[]).includes(status);
}

export function isVendorReEvaluateSkippedTerminal(status: string): boolean {
  return (
    status === "paid" ||
    status === CANCELLED_DUE_TO_REFUND_STATUS ||
    status === PARTIAL_REFUND_MANUAL_REVIEW_STATUS ||
    status === IDEMPOTENCY_MISMATCH_STATUS ||
    status === "failed"
  );
}

export function isPodReEvaluateSkippedTerminal(status: string): boolean {
  return (
    status === POD_PAYOUT_TRANSFER_STATUS.paid ||
    status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund ||
    status === POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview ||
    status === POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch ||
    status === POD_PAYOUT_TRANSFER_STATUS.failed
  );
}

export const ADMIN_PAYOUT_BETA_RUNBOOK = [
  "Vendor Connect transfers are created at payment and attempted automatically when the vendor account is payout-ready.",
  "If vendor retry cron is enabled (every 15–30 minutes), failed or balance-blocked vendor transfers are retried with existing safety checks. Admins can also retry or reconcile from this page.",
  "Pod revenue share payouts are manual: run a payout batch on each active pod from the pod admin page (Payouts section) or after vendor transfers settle.",
  "Beta cadence: review blocked transfers daily; run pod batches daily or after vendor batches; keep Stripe platform minimum balance at $2,500.",
  "Review blocked_partial_refund_review rows before sending any transfer.",
  "Pod post-transfer refunds require manual review and recovery for now — there is no automated pod clawback.",
  "Connect transfers (vendor/pod) move money to connected accounts. Stripe platform payouts move remaining balance to Open Order's bank — they are separate.",
] as const;
