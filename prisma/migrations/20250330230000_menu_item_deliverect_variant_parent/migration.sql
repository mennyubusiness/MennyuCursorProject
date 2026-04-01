-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "deliverectVariantParentPlu" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "deliverectVariantParentName" TEXT;
