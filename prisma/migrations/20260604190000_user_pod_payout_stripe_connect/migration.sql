-- User-level Stripe Connect fields for pod owner payout transfers (separate from vendor Connect).

ALTER TABLE "User" ADD COLUMN "podPayoutStripeConnectedAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN "podPayoutStripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "podPayoutStripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "podPayoutStripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "podPayoutStripeOnboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "podPayoutStripeRequirementsCurrentlyDue" JSONB;
ALTER TABLE "User" ADD COLUMN "podPayoutStripeLastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_podPayoutStripeConnectedAccountId_key" ON "User"("podPayoutStripeConnectedAccountId");
