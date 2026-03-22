-- AlterTable
ALTER TABLE "RefundAttempt" ADD COLUMN IF NOT EXISTS "dismissedAsLegacyAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dismissedAsLegacyBy" TEXT;
