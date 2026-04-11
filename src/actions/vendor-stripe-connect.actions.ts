"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import {
  createVendorConnectedAccount,
  createVendorOnboardingLink,
  retrieveAndSyncVendorConnectedAccount,
  StripeConnectNotConfiguredError,
} from "@/services/stripe-connect.service";

export type VendorStripeConnectStartResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Creates a Connect Express account if needed and returns a Stripe-hosted onboarding URL.
 */
export async function startVendorStripeConnectOnboarding(
  vendorId: string
): Promise<VendorStripeConnectStartResult> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Not signed in." };
    if (!(await canManageVendor(userId, vendorId))) {
      return { ok: false, error: "You don’t have permission to manage payouts for this restaurant." };
    }

    const origin = await getPublicSiteOrigin();
    const accountId = await createVendorConnectedAccount(vendorId);
    const returnUrl = `${origin}/vendor/${encodeURIComponent(vendorId)}/settings?stripe_connect=return`;
    const refreshUrl = `${origin}/vendor/${encodeURIComponent(vendorId)}/settings?stripe_connect=refresh`;
    const url = await createVendorOnboardingLink(accountId, returnUrl, refreshUrl);

    revalidatePath(`/vendor/${vendorId}/settings`);
    return { ok: true, url };
  } catch (e) {
    if (e instanceof StripeConnectNotConfiguredError) {
      return { ok: false, error: "Stripe payouts are not configured for this environment yet." };
    }
    console.error("[startVendorStripeConnectOnboarding]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not start Stripe onboarding." };
  }
}

export async function syncVendorStripeConnectStatusAction(
  vendorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Not signed in." };
    if (!(await canManageVendor(userId, vendorId))) {
      return { ok: false, error: "You don’t have permission." };
    }
    await retrieveAndSyncVendorConnectedAccount(vendorId);
    revalidatePath(`/vendor/${vendorId}/settings`);
    return { ok: true };
  } catch (e) {
    if (e instanceof StripeConnectNotConfiguredError) {
      return { ok: false, error: "Stripe is not configured." };
    }
    console.error("[syncVendorStripeConnectStatusAction]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}
