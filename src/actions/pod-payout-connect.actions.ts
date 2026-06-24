"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import {
  createPodPayoutAccountManagementLink,
  createPodPayoutOnboardingLink,
  isUserDesignatedPodPayoutRecipient,
  loadPodPayoutRecipientContext,
  StripeConnectNotConfiguredError,
  syncPodPayoutConnectedAccountStatus,
} from "@/services/pod-payout-connect.service";

export type PodPayoutConnectStartResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

async function assertPodPayoutAccountOwner(
  userId: string,
  podId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await loadPodPayoutRecipientContext(podId.trim());
  if (!ctx?.podPayoutsEnabled) {
    return { ok: false, error: "Pod payouts are not enabled for this pod yet." };
  }
  if (!(await isUserDesignatedPodPayoutRecipient(userId, podId))) {
    return {
      ok: false,
      error: "Only the payout account owner can manage payout setup for this pod.",
    };
  }
  return { ok: true };
}

export async function startPodPayoutConnectOnboarding(
  podId: string
): Promise<PodPayoutConnectStartResult> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Not signed in." };

    const allowed = await assertPodPayoutAccountOwner(userId, podId);
    if (!allowed.ok) return allowed;

    const origin = await getPublicSiteOrigin();
    const returnUrl = `${origin}/pod/${encodeURIComponent(podId)}/settings?pod_payout_connect=return`;
    const refreshUrl = `${origin}/pod/${encodeURIComponent(podId)}/settings?pod_payout_connect=refresh`;
    const url = await createPodPayoutOnboardingLink(userId, returnUrl, refreshUrl, { podId });

    revalidatePath(`/pod/${podId}/settings`);
    revalidatePath(`/pod/${podId}/dashboard`);
    revalidatePath(`/admin/pods/${podId}`);
    return { ok: true, url };
  } catch (e) {
    if (e instanceof StripeConnectNotConfiguredError) {
      return { ok: false, error: "Payout setup is not configured for this environment yet." };
    }
    console.error("[startPodPayoutConnectOnboarding]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not start payout setup." };
  }
}

export async function openPodPayoutAccountManagement(
  podId: string
): Promise<PodPayoutConnectStartResult> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Not signed in." };

    const allowed = await assertPodPayoutAccountOwner(userId, podId);
    if (!allowed.ok) return allowed;

    const origin = await getPublicSiteOrigin();
    const returnUrl = `${origin}/pod/${encodeURIComponent(podId)}/settings?pod_payout_connect=return`;
    const refreshUrl = `${origin}/pod/${encodeURIComponent(podId)}/settings?pod_payout_connect=refresh`;
    const url = await createPodPayoutAccountManagementLink(userId, returnUrl, refreshUrl);

    revalidatePath(`/pod/${podId}/settings`);
    revalidatePath(`/pod/${podId}/dashboard`);
    revalidatePath(`/admin/pods/${podId}`);
    return { ok: true, url };
  } catch (e) {
    if (e instanceof StripeConnectNotConfiguredError) {
      return { ok: false, error: "Payout setup is not configured for this environment yet." };
    }
    console.error("[openPodPayoutAccountManagement]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not open payout account management." };
  }
}

export async function syncPodPayoutConnectStatusAction(
  podId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Not signed in." };
    if (!(await isUserDesignatedPodPayoutRecipient(userId, podId))) {
      return { ok: false, error: "You don’t have permission to refresh payout setup for this pod." };
    }
    await syncPodPayoutConnectedAccountStatus(userId);
    revalidatePath(`/pod/${podId}/settings`);
    revalidatePath(`/pod/${podId}/dashboard`);
    revalidatePath(`/admin/pods/${podId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof StripeConnectNotConfiguredError) {
      return { ok: false, error: "Payout setup is not configured." };
    }
    console.error("[syncPodPayoutConnectStatusAction]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}
