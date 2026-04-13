-- Stripe Connect transfer reversals (after platform refunds); execution state separate from RefundAttempt.

CREATE TABLE "VendorPayoutTransferReversal" (
    "id" TEXT NOT NULL,
    "vendorPayoutTransferId" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "refundAttemptId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "stripeTransferReversalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failureMessage" TEXT,
    "batchKey" TEXT,
    "submittedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "VendorPayoutTransferReversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorPayoutTransferReversal_stripeTransferReversalId_key" ON "VendorPayoutTransferReversal"("stripeTransferReversalId");
CREATE UNIQUE INDEX "VendorPayoutTransferReversal_idempotencyKey_key" ON "VendorPayoutTransferReversal"("idempotencyKey");
CREATE UNIQUE INDEX "VendorPayoutTransferReversal_refundAttemptId_vendorPayoutTransferId_key" ON "VendorPayoutTransferReversal"("refundAttemptId", "vendorPayoutTransferId");
CREATE INDEX "VendorPayoutTransferReversal_status_idx" ON "VendorPayoutTransferReversal"("status");
CREATE INDEX "VendorPayoutTransferReversal_vendorOrderId_idx" ON "VendorPayoutTransferReversal"("vendorOrderId");
CREATE INDEX "VendorPayoutTransferReversal_orderId_idx" ON "VendorPayoutTransferReversal"("orderId");
CREATE INDEX "VendorPayoutTransferReversal_refundAttemptId_idx" ON "VendorPayoutTransferReversal"("refundAttemptId");

ALTER TABLE "VendorPayoutTransferReversal" ADD CONSTRAINT "VendorPayoutTransferReversal_vendorPayoutTransferId_fkey" FOREIGN KEY ("vendorPayoutTransferId") REFERENCES "VendorPayoutTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransferReversal" ADD CONSTRAINT "VendorPayoutTransferReversal_refundAttemptId_fkey" FOREIGN KEY ("refundAttemptId") REFERENCES "RefundAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransferReversal" ADD CONSTRAINT "VendorPayoutTransferReversal_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransferReversal" ADD CONSTRAINT "VendorPayoutTransferReversal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransferReversal" ADD CONSTRAINT "VendorPayoutTransferReversal_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
