-- CreateEnum
CREATE TYPE "VendorOrderRoutingMode" AS ENUM ('manual_dashboard', 'deliverect');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "orderRoutingMode" "VendorOrderRoutingMode" NOT NULL DEFAULT 'manual_dashboard';

-- Existing Deliverect-linked vendors default to Deliverect routing; others stay on dashboard routing.
UPDATE "Vendor"
SET "orderRoutingMode" = 'deliverect'
WHERE "deliverectChannelLinkId" IS NOT NULL AND TRIM("deliverectChannelLinkId") <> '';
