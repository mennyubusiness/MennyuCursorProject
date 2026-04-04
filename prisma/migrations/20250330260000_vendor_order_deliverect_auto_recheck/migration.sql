-- AlterTable
ALTER TABLE "VendorOrder" ADD COLUMN     "deliverectAutoRecheckAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "deliverectAutoRecheckResult" TEXT;
