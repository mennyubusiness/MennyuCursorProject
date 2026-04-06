-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "customerServiceFeeBps" INTEGER NOT NULL,
    "customerServiceFeeFlatCents" INTEGER NOT NULL DEFAULT 0,
    "vendorProcessingFeeBps" INTEGER NOT NULL,
    "vendorProcessingFeeFlatCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VendorOrder" RENAME COLUMN "platformCommissionCents" TO "vendorProcessingFeeRecoveryCents";

-- AlterTable
ALTER TABLE "VendorOrder" ADD COLUMN "vendorProcessingFeeBpsApplied" INTEGER,
ADD COLUMN "vendorProcessingFeeFlatCentsApplied" INTEGER,
ADD COLUMN "vendorGrossPayableCents" INTEGER,
ADD COLUMN "vendorNetPayoutCents" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pricingConfigId" TEXT,
ADD COLUMN "customerServiceFeeBpsApplied" INTEGER,
ADD COLUMN "customerServiceFeeFlatCentsApplied" INTEGER,
ADD COLUMN "vendorProcessingFeeBpsApplied" INTEGER,
ADD COLUMN "vendorProcessingFeeFlatCentsApplied" INTEGER;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingConfigId_fkey" FOREIGN KEY ("pricingConfigId") REFERENCES "PricingConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default active config (matches prior hardcoded 3.5% / 2.75% + zero flat)
INSERT INTO "PricingConfig" (
    "id",
    "customerServiceFeeBps",
    "customerServiceFeeFlatCents",
    "vendorProcessingFeeBps",
    "vendorProcessingFeeFlatCents",
    "isActive",
    "effectiveAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'cmpricing_seed_v1',
    350,
    0,
    275,
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
