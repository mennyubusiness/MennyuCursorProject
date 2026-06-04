-- Admin legacy financial review for historical clawback cases (audit trail; does not mark clawback recovered).
ALTER TABLE "VendorPayoutTransfer" ADD COLUMN "legacyClawbackReviewStatus" TEXT;
ALTER TABLE "VendorPayoutTransfer" ADD COLUMN "legacyClawbackReviewNote" TEXT;
ALTER TABLE "VendorPayoutTransfer" ADD COLUMN "legacyClawbackReviewedAt" TIMESTAMP(3);
ALTER TABLE "VendorPayoutTransfer" ADD COLUMN "legacyClawbackReviewedBy" TEXT;

CREATE INDEX "VendorPayoutTransfer_legacyClawbackReviewStatus_idx" ON "VendorPayoutTransfer"("legacyClawbackReviewStatus");
