-- AlterTable: add manual recovery metadata to VendorOrder (preserves routing failure in audit)
ALTER TABLE "VendorOrder" ADD COLUMN "manuallyRecoveredAt" TIMESTAMP(3),
ADD COLUMN "manuallyRecoveredBy" TEXT,
ADD COLUMN "manualRecoveryNotes" TEXT;
