-- Link orders to the checkout cart so we can clear stale line items after payment or cancel.
ALTER TABLE "Order" ADD COLUMN "sourceCartId" TEXT;

CREATE INDEX "Order_sourceCartId_idx" ON "Order"("sourceCartId");
