-- Link orders to the checkout cart so we can clear stale line items after payment or cancel.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sourceCartId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_sourceCartId_idx" ON "Order"("sourceCartId");
