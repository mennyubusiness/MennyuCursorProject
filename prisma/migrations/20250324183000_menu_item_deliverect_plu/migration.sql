ALTER TABLE "MenuItem"
ADD COLUMN IF NOT EXISTS "deliverectPlu" TEXT;

CREATE INDEX IF NOT EXISTS "MenuItem_vendorId_deliverectPlu_idx"
ON "MenuItem"("vendorId", "deliverectPlu");