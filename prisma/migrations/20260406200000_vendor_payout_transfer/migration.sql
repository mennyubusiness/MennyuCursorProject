-- Vendor payout transfer execution (Stripe Connect); one row per PaymentAllocation.

CREATE TABLE "VendorPayoutTransfer" (
    "id" TEXT NOT NULL,
    "paymentAllocationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "blockedReason" TEXT,
    "stripeTransferId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "batchKey" TEXT,
    "failureMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPayoutTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorPayoutTransfer_paymentAllocationId_key" ON "VendorPayoutTransfer"("paymentAllocationId");
CREATE UNIQUE INDEX "VendorPayoutTransfer_stripeTransferId_key" ON "VendorPayoutTransfer"("stripeTransferId");
CREATE UNIQUE INDEX "VendorPayoutTransfer_idempotencyKey_key" ON "VendorPayoutTransfer"("idempotencyKey");
CREATE INDEX "VendorPayoutTransfer_status_idx" ON "VendorPayoutTransfer"("status");
CREATE INDEX "VendorPayoutTransfer_batchKey_idx" ON "VendorPayoutTransfer"("batchKey");
CREATE INDEX "VendorPayoutTransfer_vendorId_idx" ON "VendorPayoutTransfer"("vendorId");

ALTER TABLE "VendorPayoutTransfer" ADD CONSTRAINT "VendorPayoutTransfer_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransfer" ADD CONSTRAINT "VendorPayoutTransfer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorPayoutTransfer" ADD CONSTRAINT "VendorPayoutTransfer_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
