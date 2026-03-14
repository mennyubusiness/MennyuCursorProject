-- CreateTable
CREATE TABLE "OrderIssue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "resolvedBy" TEXT,

    CONSTRAINT "OrderIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorOrderIssue" (
    "id" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "resolvedBy" TEXT,

    CONSTRAINT "VendorOrderIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderIssue_orderId_idx" ON "OrderIssue"("orderId");

-- CreateIndex
CREATE INDEX "OrderIssue_orderId_status_idx" ON "OrderIssue"("orderId", "status");

-- CreateIndex
CREATE INDEX "VendorOrderIssue_vendorOrderId_idx" ON "VendorOrderIssue"("vendorOrderId");

-- CreateIndex
CREATE INDEX "VendorOrderIssue_vendorOrderId_status_idx" ON "VendorOrderIssue"("vendorOrderId", "status");

-- AddForeignKey
ALTER TABLE "OrderIssue" ADD CONSTRAINT "OrderIssue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorOrderIssue" ADD CONSTRAINT "VendorOrderIssue_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
