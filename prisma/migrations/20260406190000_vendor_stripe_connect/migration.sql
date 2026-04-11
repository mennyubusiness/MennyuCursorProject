-- Stripe Connect Express: vendor payout onboarding (readiness only; no payout orchestration in this pass).

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripeConnectedAccountId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripeOnboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "stripeRequirementsCurrentlyDue" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_stripeConnectedAccountId_key" ON "Vendor"("stripeConnectedAccountId");
