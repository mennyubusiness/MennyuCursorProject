-- AlterTable
ALTER TABLE "Pod" ADD COLUMN "accentColor" TEXT;

-- AlterTable
ALTER TABLE "PodVendor" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
