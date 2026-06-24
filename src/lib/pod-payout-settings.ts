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
      error: `Revenue share must be between 0 and ${POD_PAYOUT_MAX_REVENUE_SHARE_BPS} basis points (0–${podRevenueShareBpsToPercentLabel(POD_PAYOUT_MAX_REVENUE_SHARE_BPS)}).`,
    };
  }

  if (podPayoutRecipientUserId && !ctx.podOwnerUserIds.includes(podPayoutRecipientUserId)) {
    return {
      ok: false,
      error: "Designated recipient must be a pod owner for this pod.",
    };
  }

  if (podPayoutsEnabled) {
    if (podRevenueShareBps <= 0) {
      return { ok: false, error: "Revenue share must be greater than 0 when pod payouts are enabled." };
    }
    if (!podPayoutRecipientUserId) {
      return { ok: false, error: "Designated recipient is required when pod payouts are enabled." };
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
