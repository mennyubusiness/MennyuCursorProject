/**
 * Pure helpers for pod owner revenue share allocations (food subtotal × bps).
 * Does not include tips, tax, service fee, Stripe fees, or vendor payout amounts.
 */

import { roundCents } from "@/domain/money";

/** Beta cap: 5.00% of eligible food subtotal. */
export const POD_PAYOUT_MAX_REVENUE_SHARE_BPS = 500;

export const POD_PAYOUT_ALLOCATION_STATUS = {
  pending: "pending",
  blocked: "blocked",
  cancelledDueToRefund: "cancelled_due_to_refund",
  blockedPartialRefundReview: "blocked_partial_refund_review",
} as const;

export type PodPayoutAllocationStatus =
  (typeof POD_PAYOUT_ALLOCATION_STATUS)[keyof typeof POD_PAYOUT_ALLOCATION_STATUS];

export const POD_PAYOUT_BLOCKED_REASON = {
  missingRecipient: "missing_recipient",
  zeroSubtotal: "zero_subtotal",
  invalidBps: "invalid_bps",
} as const;

export type PodPayoutSettingsSnapshot = {
  podPayoutsEnabled: boolean;
  podRevenueShareBps: number;
  podPayoutRecipientUserId: string | null;
};

export type PodPayoutAllocationDecision =
  | { action: "skip" }
  | {
      action: "create";
      status: PodPayoutAllocationStatus;
      blockedReason: string | null;
      revenueShareBps: number;
      eligibleSubtotalCents: number;
      podPayoutAmountCents: number;
      podPayoutRecipientUserId: string | null;
    };

export function isValidPodRevenueShareBps(bps: number): boolean {
  return Number.isInteger(bps) && bps >= 0 && bps <= POD_PAYOUT_MAX_REVENUE_SHARE_BPS;
}

/**
 * Pod payout = eligible food subtotal × revenue share bps (rounded to nearest cent).
 */
export function podPayoutAmountCentsFromSubtotal(
  eligibleSubtotalCents: number,
  revenueShareBps: number
): number {
  if (eligibleSubtotalCents <= 0 || revenueShareBps <= 0) return 0;
  return roundCents((eligibleSubtotalCents * revenueShareBps) / 10_000);
}

export function isPodPayoutSettingsEligibleForAllocation(
  settings: PodPayoutSettingsSnapshot | null | undefined
): boolean {
  if (!settings?.podPayoutsEnabled) return false;
  if (settings.podRevenueShareBps <= 0) return false;
  return true;
}

/**
 * Decide whether to skip or create a PodPayoutAllocation row for a successful payment.
 */
export function resolvePodPayoutAllocationDecision(
  eligibleSubtotalCents: number,
  settings: PodPayoutSettingsSnapshot | null | undefined
): PodPayoutAllocationDecision {
  if (!isPodPayoutSettingsEligibleForAllocation(settings)) {
    return { action: "skip" };
  }

  const revenueShareBps = settings!.podRevenueShareBps;
  const recipientId = settings!.podPayoutRecipientUserId?.trim() || null;

  if (!isValidPodRevenueShareBps(revenueShareBps)) {
    return {
      action: "create",
      status: POD_PAYOUT_ALLOCATION_STATUS.blocked,
      blockedReason: POD_PAYOUT_BLOCKED_REASON.invalidBps,
      revenueShareBps,
      eligibleSubtotalCents,
      podPayoutAmountCents: 0,
      podPayoutRecipientUserId: recipientId,
    };
  }

  if (!recipientId) {
    return {
      action: "create",
      status: POD_PAYOUT_ALLOCATION_STATUS.blocked,
      blockedReason: POD_PAYOUT_BLOCKED_REASON.missingRecipient,
      revenueShareBps,
      eligibleSubtotalCents,
      podPayoutAmountCents: podPayoutAmountCentsFromSubtotal(eligibleSubtotalCents, revenueShareBps),
      podPayoutRecipientUserId: null,
    };
  }

  if (eligibleSubtotalCents <= 0) {
    return {
      action: "create",
      status: POD_PAYOUT_ALLOCATION_STATUS.blocked,
      blockedReason: POD_PAYOUT_BLOCKED_REASON.zeroSubtotal,
      revenueShareBps,
      eligibleSubtotalCents,
      podPayoutAmountCents: 0,
      podPayoutRecipientUserId: recipientId,
    };
  }

  return {
    action: "create",
    status: POD_PAYOUT_ALLOCATION_STATUS.pending,
    blockedReason: null,
    revenueShareBps,
    eligibleSubtotalCents,
    podPayoutAmountCents: podPayoutAmountCentsFromSubtotal(eligibleSubtotalCents, revenueShareBps),
    podPayoutRecipientUserId: recipientId,
  };
}
