-- CreateEnum
CREATE TYPE "VendorMenuSource" AS ENUM ('open_order', 'deliverect');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "menuSource" "VendorMenuSource" NOT NULL DEFAULT 'open_order';

-- Backfill Deliverect menu source from routing mode or active channel link.
UPDATE "Vendor"
SET "menuSource" = 'deliverect'
WHERE "orderRoutingMode" = 'deliverect'
   OR (
     "deliverectChannelLinkId" IS NOT NULL
     AND TRIM("deliverectChannelLinkId") <> ''
   );

-- CreateTable
CREATE TABLE "VendorMenuCategory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorMenuCategory_vendorId_sortOrder_idx" ON "VendorMenuCategory"("vendorId", "sortOrder");

-- AddForeignKey
ALTER TABLE "VendorMenuCategory" ADD CONSTRAINT "VendorMenuCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
