-- CreateTable
CREATE TABLE "PodPayoutTransfer" (
    "id" TEXT NOT NULL,
    "podPayoutAllocationId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "destinationAccountId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "batchKey" TEXT,
    "blockedReason" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodPayoutTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodPayoutTransfer_podPayoutAllocationId_key" ON "PodPayoutTransfer"("podPayoutAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "PodPayoutTransfer_stripeTransferId_key" ON "PodPayoutTransfer"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "PodPayoutTransfer_idempotencyKey_key" ON "PodPayoutTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PodPayoutTransfer_podId_status_idx" ON "PodPayoutTransfer"("podId", "status");

-- CreateIndex
CREATE INDEX "PodPayoutTransfer_status_createdAt_idx" ON "PodPayoutTransfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PodPayoutTransfer_batchKey_idx" ON "PodPayoutTransfer"("batchKey");

-- CreateIndex
CREATE INDEX "PodPayoutTransfer_podId_createdAt_idx" ON "PodPayoutTransfer"("podId", "createdAt");

-- AddForeignKey
ALTER TABLE "PodPayoutTransfer" ADD CONSTRAINT "PodPayoutTransfer_podPayoutAllocationId_fkey" FOREIGN KEY ("podPayoutAllocationId") REFERENCES "PodPayoutAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodPayoutTransfer" ADD CONSTRAINT "PodPayoutTransfer_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
