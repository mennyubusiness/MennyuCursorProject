/**
 * Pod payout settings validation (pure helpers).
 */

import {
  POD_PAYOUT_MAX_REVENUE_SHARE_BPS,
  isValidPodRevenueShareBps,
} from "@/lib/pod-payout-allocation";

export type UpdatePodPayoutSettingsInput = {
  podId: string;
  podPayoutsEnabled: boolean;
  podRevenueShareBps: number;
  podPayoutRecipientUserId: string | null;
  minimumPayoutCents: number;
};

export type PodPayoutSettingsValidationContext = {
  /** User ids with PodMembershipRole.owner for this pod. */
  podOwnerUserIds: string[];
};

export type PodPayoutSettingsValidationResult =
  | {
      ok: true;
      normalized: {
        podPayoutsEnabled: boolean;
        podRevenueShareBps: number;
        podPayoutRecipientUserId: string | null;
        minimumPayoutCents: number;
      };
    }
  | { ok: false; error: string };

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function podRevenueShareBpsToPercentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Stored bps → admin UI percent (e.g. 75 → 0.75, 500 → 5). */
export function podRevenueShareBpsToPercent(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.round(bps) / 100;
}

/** Admin UI percent → stored bps (e.g. 0.75 → 75, 5 → 500). */
export function podRevenueSharePercentToBps(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.round(percent * 100);
}

/** Stored cents → admin UI dollars (e.g. 1000 → 10). */
export function minimumPayoutCentsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

/** Admin UI dollars → stored cents (e.g. 10 → 1000, 0.5 → 50). */
export function minimumPayoutDollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

export function formatPodSharePercentForInput(bps: number): string {
  const value = podRevenueShareBpsToPercent(bps);
  if (value === 0) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatMinimumPayoutDollarsForInput(cents: number): string {
  const value = minimumPayoutCentsToDollars(cents);
  if (value === 0) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function normalizePodPayoutRecipientUserId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Validate admin pod payout settings before upsert.
 * When disabled, recipient and bps may remain saved for later re-enable.
 */
export function validateUpdatePodPayoutSettingsInput(
  input: UpdatePodPayoutSettingsInput,
  ctx: PodPayoutSettingsValidationContext
): PodPayoutSettingsValidationResult {
  const podPayoutsEnabled = Boolean(input.podPayoutsEnabled);
  const podRevenueShareBps = clampNonNegInt(input.podRevenueShareBps);
  const minimumPayoutCents = clampNonNegInt(input.minimumPayoutCents);
  const podPayoutRecipientUserId = normalizePodPayoutRecipientUserId(input.podPayoutRecipientUserId);

  if (!isValidPodRevenueShareBps(podRevenueShareBps)) {
    return {
      ok: false,
      error: `Pod share must be between 0% and ${podRevenueShareBpsToPercentLabel(POD_PAYOUT_MAX_REVENUE_SHARE_BPS)}.`,
    };
  }

  if (podPayoutRecipientUserId && !ctx.podOwnerUserIds.includes(podPayoutRecipientUserId)) {
    return {
      ok: false,
      error: "Payout account owner must be a pod owner for this pod.",
    };
  }

  if (podPayoutsEnabled) {
    if (podRevenueShareBps <= 0) {
      return { ok: false, error: "Pod share must be greater than 0% when pod payouts are enabled." };
    }
    if (!podPayoutRecipientUserId) {
      return { ok: false, error: "Payout account owner is required when pod payouts are enabled." };
    }
  }

  return {
    ok: true,
    normalized: {
      podPayoutsEnabled,
      podRevenueShareBps,
      podPayoutRecipientUserId,
      minimumPayoutCents,
    },
  };
}
