-- Square order injection: vendor enable flag + vendor order audit fields
ALTER TABLE "Vendor" ADD COLUMN "squareOrderRoutingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "VendorOrder" ADD COLUMN "squareOrderId" TEXT;
ALTER TABLE "VendorOrder" ADD COLUMN "squareAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VendorOrder" ADD COLUMN "squareLastError" TEXT;
ALTER TABLE "VendorOrder" ADD COLUMN "squareSubmittedAt" TIMESTAMP(3);
ALTER TABLE "VendorOrder" ADD COLUMN "lastSquarePayload" JSONB;
ALTER TABLE "VendorOrder" ADD COLUMN "lastSquareResponse" JSONB;

CREATE INDEX "VendorOrder_squareOrderId_idx" ON "VendorOrder"("squareOrderId");
