-- CreateEnum
CREATE TYPE "OrderRefundStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled', 'requires_action');

-- CreateEnum
CREATE TYPE "OrderRefundScope" AS ENUM ('full_order', 'full_vendor_order', 'custom_vendor_partial', 'system_cancel', 'vendor_denial', 'legacy');

-- CreateEnum
CREATE TYPE "OrderRefundInitiatedByRole" AS ENUM ('admin', 'customer', 'vendor', 'system');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalRefundedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentRefundStatus" TEXT;

-- AlterTable
ALTER TABLE "VendorOrder" ADD COLUMN IF NOT EXISTS "totalRefundedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeBalanceTransactionId" TEXT;

-- CreateTable
CREATE TABLE "OrderRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorOrderId" TEXT,
    "paymentId" TEXT,
    "refundAttemptId" TEXT,
    "stripeRefundId" TEXT,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT NOT NULL,
    "status" "OrderRefundStatus" NOT NULL,
    "refundScope" "OrderRefundScope" NOT NULL,
    "initiatedByUserId" TEXT,
    "initiatedByRole" "OrderRefundInitiatedByRole" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "adminNote" TEXT,
    "customerVisibleNote" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "stripeRawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderRefund_refundAttemptId_key" ON "OrderRefund"("refundAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRefund_stripeRefundId_key" ON "OrderRefund"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRefund_idempotencyKey_key" ON "OrderRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderRefund_orderId_idx" ON "OrderRefund"("orderId");

-- CreateIndex
CREATE INDEX "OrderRefund_vendorOrderId_idx" ON "OrderRefund"("vendorOrderId");

-- CreateIndex
CREATE INDEX "OrderRefund_stripePaymentIntentId_idx" ON "OrderRefund"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "OrderRefund_orderId_status_idx" ON "OrderRefund"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_stripeChargeId_idx" ON "Payment"("stripeChargeId");

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_refundAttemptId_fkey" FOREIGN KEY ("refundAttemptId") REFERENCES "RefundAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
