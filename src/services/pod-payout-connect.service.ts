/**
 * Stripe Connect Express for pod owner payout recipients (User-level accounts).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  derivePodPayoutConnectStatus,
  type PodPayoutConnectStatusView,
  type PodPayoutConnectUserSnapshot,
} from "@/lib/pod-payout-connect-status";
import {
  createConnectAccountUpdateLink,
  createConnectExpressLoginLink,
  createConnectOnboardingLink,
  StripeConnectNotConfiguredError,
  stripeAccountToPodPayoutUserUpdateInput,
} from "@/services/stripe-connect.service";
import { stripe } from "@/lib/stripe";

export { StripeConnectNotConfiguredError };

const podPayoutConnectUserSelect = {
  id: true,
  email: true,
  name: true,
  podPayoutStripeConnectedAccountId: true,
  podPayoutStripeDetailsSubmitted: true,
  podPayoutStripeChargesEnabled: true,
  podPayoutStripePayoutsEnabled: true,
  podPayoutStripeOnboardingCompletedAt: true,
  podPayoutStripeRequirementsCurrentlyDue: true,
  podPayoutStripeLastSyncedAt: true,
} as const;

function requireStripeConfigured() {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    throw new StripeConnectNotConfiguredError();
  }
  return stripe;
}

function toUserSnapshot(
  user: {
    podPayoutStripeConnectedAccountId: string | null;
    podPayoutStripeChargesEnabled: boolean;
    podPayoutStripePayoutsEnabled: boolean;
    podPayoutStripeRequirementsCurrentlyDue: unknown;
  }
): PodPayoutConnectUserSnapshot {
  return {
    podPayoutStripeConnectedAccountId: user.podPayoutStripeConnectedAccountId,
    podPayoutStripeChargesEnabled: user.podPayoutStripeChargesEnabled,
    podPayoutStripePayoutsEnabled: user.podPayoutStripePayoutsEnabled,
    podPayoutStripeRequirementsCurrentlyDue: user.podPayoutStripeRequirementsCurrentlyDue,
  };
}

export type PodPayoutConnectStatusResult = PodPayoutConnectStatusView & {
  userId: string;
  stripeConnectConfigured: boolean;
  onboardingCompletedAt: Date | null;
  lastSyncedAt: Date | null;
};

export async function getPodPayoutConnectStatus(userId: string): Promise<PodPayoutConnectStatusResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: podPayoutConnectUserSelect,
  });
  if (!user) return null;

  const status = derivePodPayoutConnectStatus(toUserSnapshot(user));
  return {
    ...status,
    userId: user.id,
    stripeConnectConfigured: Boolean(env.STRIPE_SECRET_KEY),
    onboardingCompletedAt: user.podPayoutStripeOnboardingCompletedAt,
    lastSyncedAt: user.podPayoutStripeLastSyncedAt,
  };
}

/**
 * Idempotent: creates Connect Express account on User if missing.
 */
export async function getOrCreatePodPayoutConnectedAccountForUser(
  userId: string,
  opts?: { podId?: string }
): Promise<string> {
  const s = requireStripeConfigured();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      podPayoutStripeConnectedAccountId: true,
    },
  });
  if (!user) {
    throw new Error("User not found.");
  }
  if (user.podPayoutStripeConnectedAccountId?.trim()) {
    return user.podPayoutStripeConnectedAccountId.trim();
  }

  const country = (env.STRIPE_CONNECT_ACCOUNT_COUNTRY || "US").toUpperCase();
  const metadata: Record<string, string> = {
    openOrderPurpose: "pod_payout",
    openOrderUserId: user.id,
    platform: "open_order",
    mennyu_user_id: user.id,
    mennyu_connect_purpose: "pod_payout",
  };
  if (opts?.podId?.trim()) {
    metadata.openOrderPodId = opts.podId.trim();
    metadata.mennyu_pod_id = opts.podId.trim();
  }

  const account = await s.accounts.create({
    type: "express",
    country,
    email: user.email,
    metadata,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { podPayoutStripeConnectedAccountId: account.id },
  });

  return account.id;
}

export async function createPodPayoutOnboardingLink(
  userId: string,
  returnUrl: string,
  refreshUrl: string,
  opts?: { podId?: string }
): Promise<string> {
  const accountId = await getOrCreatePodPayoutConnectedAccountForUser(userId, opts);
  return createConnectOnboardingLink(accountId, returnUrl, refreshUrl);
}

/**
 * Opens Stripe-hosted payout account management for an existing Connect account.
 * Ready accounts use the Express Dashboard login link; accounts with open requirements use account_update.
 */
export async function createPodPayoutAccountManagementLink(
  userId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  requireStripeConfigured();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      podPayoutStripeConnectedAccountId: true,
      podPayoutStripeChargesEnabled: true,
      podPayoutStripePayoutsEnabled: true,
      podPayoutStripeRequirementsCurrentlyDue: true,
      podPayoutStripeDetailsSubmitted: true,
    },
  });
  if (!user?.podPayoutStripeConnectedAccountId?.trim()) {
    throw new Error("Payout account has not been created yet.");
  }

  const accountId = user.podPayoutStripeConnectedAccountId.trim();
  const status = derivePodPayoutConnectStatus(toUserSnapshot(user));

  if (status.ready) {
    return createConnectExpressLoginLink(accountId);
  }

  if (status.code === "needs_attention") {
    return createConnectAccountUpdateLink(accountId, returnUrl, refreshUrl);
  }

  if (user.podPayoutStripeDetailsSubmitted) {
    return createConnectAccountUpdateLink(accountId, returnUrl, refreshUrl);
  }

  throw new Error("Complete payout setup before managing the payout account.");
}

export async function syncPodPayoutConnectedAccountStatus(userId: string): Promise<void> {
  const s = requireStripeConfigured();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      podPayoutStripeConnectedAccountId: true,
      podPayoutStripeOnboardingCompletedAt: true,
    },
  });
  if (!user?.podPayoutStripeConnectedAccountId?.trim()) {
    return;
  }

  const acct = await s.accounts.retrieve(user.podPayoutStripeConnectedAccountId.trim());
  const patch = stripeAccountToPodPayoutUserUpdateInput(
    acct,
    user.podPayoutStripeOnboardingCompletedAt
  );

  await prisma.user.update({
    where: { id: userId },
    data: patch,
  });
}

export type PodPayoutRecipientContext = {
  podId: string;
  podPayoutsEnabled: boolean;
  podPayoutRecipientUserId: string | null;
};

export async function loadPodPayoutRecipientContext(
  podId: string
): Promise<PodPayoutRecipientContext | null> {
  const settings = await prisma.podPayoutSettings.findUnique({
    where: { podId },
    select: {
      podPayoutsEnabled: true,
      podPayoutRecipientUserId: true,
    },
  });
  if (!settings) {
    return {
      podId,
      podPayoutsEnabled: false,
      podPayoutRecipientUserId: null,
    };
  }
  return {
    podId,
    podPayoutsEnabled: settings.podPayoutsEnabled,
    podPayoutRecipientUserId: settings.podPayoutRecipientUserId,
  };
}

export async function isUserDesignatedPodPayoutRecipient(
  userId: string,
  podId: string
): Promise<boolean> {
  const ctx = await loadPodPayoutRecipientContext(podId);
  return ctx?.podPayoutRecipientUserId?.trim() === userId.trim();
}

export async function getPodPayoutRecipientConnectStatusForPod(
  podId: string
): Promise<(PodPayoutConnectStatusResult & { recipientUserId: string }) | null> {
  const ctx = await loadPodPayoutRecipientContext(podId);
  const recipientUserId = ctx?.podPayoutRecipientUserId?.trim();
  if (!recipientUserId) return null;

  const status = await getPodPayoutConnectStatus(recipientUserId);
  if (!status) return null;
  return { ...status, recipientUserId };
}
