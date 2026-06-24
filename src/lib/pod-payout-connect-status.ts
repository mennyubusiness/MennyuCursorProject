/**
 * Pod payout Connect status helpers (pure — no Stripe/DB).
 */

export type PodPayoutConnectStatusCode =
  | "not_started"
  | "onboarding_incomplete"
  | "ready"
  | "needs_attention";

export type PodPayoutConnectStatusView = {
  code: PodPayoutConnectStatusCode;
  adminLabel: string;
  ownerLabel: string;
  ready: boolean;
  requirementsPendingCount: number;
  hasAccount: boolean;
};

export type PodPayoutConnectUserSnapshot = {
  podPayoutStripeConnectedAccountId: string | null;
  podPayoutStripeChargesEnabled: boolean;
  podPayoutStripePayoutsEnabled: boolean;
  podPayoutStripeRequirementsCurrentlyDue: unknown;
};

export function countPodPayoutRequirementsDue(value: unknown): number {
  if (value == null) return 0;
  return Array.isArray(value) ? value.length : 0;
}

export function isPodPayoutConnectReady(user: PodPayoutConnectUserSnapshot): boolean {
  return Boolean(
    user.podPayoutStripeConnectedAccountId?.trim() &&
      user.podPayoutStripeChargesEnabled &&
      user.podPayoutStripePayoutsEnabled
  );
}

export function derivePodPayoutConnectStatus(
  user: PodPayoutConnectUserSnapshot
): PodPayoutConnectStatusView {
  const hasAccount = Boolean(user.podPayoutStripeConnectedAccountId?.trim());
  const requirementsPendingCount = countPodPayoutRequirementsDue(
    user.podPayoutStripeRequirementsCurrentlyDue
  );
  const ready = isPodPayoutConnectReady(user);

  if (ready) {
    return {
      code: "ready",
      adminLabel: "Ready",
      ownerLabel: "Payout setup complete",
      ready: true,
      requirementsPendingCount,
      hasAccount: true,
    };
  }

  if (!hasAccount) {
    return {
      code: "not_started",
      adminLabel: "Not started",
      ownerLabel: "Payout setup not started",
      ready: false,
      requirementsPendingCount: 0,
      hasAccount: false,
    };
  }

  if (requirementsPendingCount > 0) {
    return {
      code: "needs_attention",
      adminLabel: "Requirements due",
      ownerLabel: "Additional information required",
      ready: false,
      requirementsPendingCount,
      hasAccount: true,
    };
  }

  return {
    code: "onboarding_incomplete",
    adminLabel: "Onboarding incomplete",
    ownerLabel: "Continue payout setup",
    ready: false,
    requirementsPendingCount,
    hasAccount: true,
  };
}
