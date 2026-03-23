-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "autoPublishMenus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "vendorDashboardToken" TEXT;
