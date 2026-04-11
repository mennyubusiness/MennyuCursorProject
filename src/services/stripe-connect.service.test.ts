import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { stripeAccountToVendorUpdateInput } from "./stripe-connect.service";

describe("stripeAccountToVendorUpdateInput", () => {
  it("maps charges, payouts, and outstanding requirements", () => {
    const acct = {
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: false,
      requirements: { currently_due: ["individual.verification.document"] },
    } as unknown as Stripe.Account;

    const patch = stripeAccountToVendorUpdateInput(acct, null);
    expect(patch.stripeDetailsSubmitted).toBe(true);
    expect(patch.stripeChargesEnabled).toBe(true);
    expect(patch.stripePayoutsEnabled).toBe(false);
    expect(patch.stripeOnboardingCompletedAt).toBeNull();
    expect(patch.stripeRequirementsCurrentlyDue).toEqual(["individual.verification.document"]);
  });

  it("sets onboarding completed at when both toggles turn on and none stored yet", () => {
    const acct = {
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
      requirements: { currently_due: [] },
    } as unknown as Stripe.Account;

    const patch = stripeAccountToVendorUpdateInput(acct, null);
    expect(patch.stripeOnboardingCompletedAt).toBeInstanceOf(Date);
    expect(patch.stripeRequirementsCurrentlyDue).toEqual(Prisma.DbNull);
  });

  it("keeps prior onboarding timestamp when already set", () => {
    const prior = new Date("2025-06-01T12:00:00.000Z");
    const acct = {
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: [] },
    } as unknown as Stripe.Account;

    const patch = stripeAccountToVendorUpdateInput(acct, prior);
    expect(patch.stripeOnboardingCompletedAt).toEqual(prior);
  });
});
