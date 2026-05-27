-- Customer support fields on OrderIssue (Phase: support intake)
ALTER TABLE "OrderIssue" ADD COLUMN "vendorOrderId" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "orderLineItemId" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "submittedByUserId" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "submittedByRole" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "priority" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "customerMessage" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "requestedRefundAmountCents" INTEGER;
ALTER TABLE "OrderIssue" ADD COLUMN "linkedOrderRefundId" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "OrderIssue" ADD COLUMN "resolvedByUserId" TEXT;

CREATE INDEX "OrderIssue_vendorOrderId_idx" ON "OrderIssue"("vendorOrderId");
CREATE INDEX "OrderIssue_orderLineItemId_idx" ON "OrderIssue"("orderLineItemId");
CREATE INDEX "OrderIssue_linkedOrderRefundId_idx" ON "OrderIssue"("linkedOrderRefundId");

ALTER TABLE "OrderIssue" ADD CONSTRAINT "OrderIssue_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderIssue" ADD CONSTRAINT "OrderIssue_orderLineItemId_fkey" FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderIssue" ADD CONSTRAINT "OrderIssue_linkedOrderRefundId_fkey" FOREIGN KEY ("linkedOrderRefundId") REFERENCES "OrderRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
