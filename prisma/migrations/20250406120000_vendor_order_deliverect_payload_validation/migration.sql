-- AlterTable
ALTER TABLE "VendorOrder" ADD COLUMN IF NOT EXISTS "deliverectPayloadValidation" JSONB;
