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

export const REPAIRABLE_POD_PAYOUT_BLOCKED_REASONS = [
  POD_PAYOUT_BLOCKED_REASON.missingRecipient,
  POD_PAYOUT_BLOCKED_REASON.invalidBps,
] as const;

export function isRepairablePodPayoutBlockedReason(
  blockedReason: string | null | undefined
): boolean {
  if (!blockedReason) return false;
  return (REPAIRABLE_POD_PAYOUT_BLOCKED_REASONS as readonly string[]).includes(blockedReason);
}

export const POD_PAYOUT_BLOCKED_REASON_LABELS: Record<string, string> = {
  [POD_PAYOUT_BLOCKED_REASON.missingRecipient]: "Missing designated recipient",
  [POD_PAYOUT_BLOCKED_REASON.zeroSubtotal]: "Eligible food subtotal was zero",
  [POD_PAYOUT_BLOCKED_REASON.invalidBps]: "Revenue share outside allowed range",
  customer_refund_extinguished_obligation: "Customer refund — pod payout no longer payable",
  partial_refund_manual_review: "Partial or pending refund — admin review required before transfer",
  post_transfer_refund_review: "Refund occurred after pod payout transfer — review manually",
};

export type BlockedPodPayoutAllocationRepair =
  | { repair: false }
  | {
      repair: true;
      status: typeof POD_PAYOUT_ALLOCATION_STATUS.pending;
      blockedReason: null;
      revenueShareBps: number;
      podPayoutAmountCents: number;
      podPayoutRecipientUserId: string;
    };

/**
 * Re-evaluate a blocked allocation after settings are fixed. Does not change eligibleSubtotalCents.
 */
export function resolveBlockedPodPayoutAllocationRepair(
  eligibleSubtotalCents: number,
  blockedReason: string | null,
  settings: PodPayoutSettingsSnapshot | null | undefined
): BlockedPodPayoutAllocationRepair {
  if (!isRepairablePodPayoutBlockedReason(blockedReason)) {
    return { repair: false };
  }

  const decision = resolvePodPayoutAllocationDecision(eligibleSubtotalCents, settings);
  if (
    decision.action !== "create" ||
    decision.status !== POD_PAYOUT_ALLOCATION_STATUS.pending ||
    !decision.podPayoutRecipientUserId
  ) {
    return { repair: false };
  }

  return {
    repair: true,
    status: POD_PAYOUT_ALLOCATION_STATUS.pending,
    blockedReason: null,
    revenueShareBps: decision.revenueShareBps,
    podPayoutAmountCents: decision.podPayoutAmountCents,
    podPayoutRecipientUserId: decision.podPayoutRecipientUserId,
  };
}
