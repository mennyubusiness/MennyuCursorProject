-- AlterTable
ALTER TABLE "RefundAttempt" ADD COLUMN     "dismissedAsLegacyAt" TIMESTAMP(3),
ADD COLUMN     "dismissedAsLegacyBy" TEXT;
