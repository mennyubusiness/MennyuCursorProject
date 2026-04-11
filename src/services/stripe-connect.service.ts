/**
 * Stripe Connect Express — vendor connected accounts and onboarding links only.
 * Server-only; does not change checkout / PaymentIntent flows.
 */
import "server-only";

import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export class StripeConnectNotConfiguredError extends Error {
  constructor(message = "Stripe is not configured.") {
    super(message);
    this.name = "StripeConnectNotConfiguredError";
  }
}

function requireStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new StripeConnectNotConfiguredError();
  }
  return stripe;
}

/** Maps a Stripe Account to persisted Vendor fields (pure, for tests). */
export function stripeAccountToVendorUpdateInput(
  acct: Stripe.Account,
  previousOnboardingCompletedAt: Date | null
): Prisma.VendorUpdateInput {
  const currentlyDue = acct.requirements?.currently_due ?? [];
  const detailsSubmitted = acct.details_submitted ?? false;
  const chargesEnabled = acct.charges_enabled ?? false;
  const payoutsEnabled = acct.payouts_enabled ?? false;
  const nowReady = chargesEnabled && payoutsEnabled;
  const onboardingCompletedAt =
    previousOnboardingCompletedAt ?? (nowReady ? new Date() : null);

  return {
    stripeDetailsSubmitted: detailsSubmitted,
    stripeChargesEnabled: chargesEnabled,
    stripePayoutsEnabled: payoutsEnabled,
    stripeOnboardingCompletedAt: onboardingCompletedAt,
    stripeRequirementsCurrentlyDue:
      currentlyDue.length > 0 ? (currentlyDue as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

/**
 * Creates a Stripe Connect Express account and persists `stripeConnectedAccountId`.
 * Idempotent if the vendor already has a connected account id.
 */
export async function createVendorConnectedAccount(vendorId: string): Promise<string> {
  const s = requireStripe();
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      stripeConnectedAccountId: true,
    },
  });
  if (!vendor) {
    throw new Error("Vendor not found.");
  }
  if (vendor.stripeConnectedAccountId?.trim()) {
    return vendor.stripeConnectedAccountId.trim();
  }

  const country = (env.STRIPE_CONNECT_ACCOUNT_COUNTRY || "US").toUpperCase();

  const params: Stripe.AccountCreateParams = {
    type: "express",
    country,
    metadata: {
      mennyu_vendor_id: vendor.id,
      mennyu_vendor_name: vendor.name.slice(0, 500),
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  };
  const email = vendor.contactEmail?.trim();
  if (email) {
    params.email = email;
  }

  const account = await s.accounts.create(params);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { stripeConnectedAccountId: account.id },
  });

  return account.id;
}

/** Creates a Stripe-hosted Account Link for onboarding or re-onboarding. */
export async function createVendorOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
  const s = requireStripe();
  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Retrieves the connected account from Stripe and updates local payout readiness fields. */
export async function retrieveAndSyncVendorConnectedAccount(vendorId: string): Promise<void> {
  const s = requireStripe();
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { stripeConnectedAccountId: true, stripeOnboardingCompletedAt: true },
  });
  if (!vendor?.stripeConnectedAccountId?.trim()) {
    return;
  }

  const acct = await s.accounts.retrieve(vendor.stripeConnectedAccountId.trim());
  const patch = stripeAccountToVendorUpdateInput(acct, vendor.stripeOnboardingCompletedAt);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: patch,
  });
}
