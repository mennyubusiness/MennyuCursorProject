-- Line-item refunds: RefundLineItem ledger rows + line_item_refund scope
CREATE TYPE "OrderRefundScope_new" AS ENUM (
  'full_order',
  'full_vendor_order',
  'custom_vendor_partial',
  'line_item_refund',
  'system_cancel',
  'vendor_denial',
  'legacy'
);

ALTER TABLE "OrderRefund" ALTER COLUMN "refundScope" DROP DEFAULT;
ALTER TABLE "OrderRefund"
  ALTER COLUMN "refundScope" TYPE "OrderRefundScope_new"
  USING ("refundScope"::text::"OrderRefundScope_new");

DROP TYPE "OrderRefundScope";
ALTER TYPE "OrderRefundScope_new" RENAME TO "OrderRefundScope";

CREATE TABLE "RefundLineItem" (
  "id" TEXT NOT NULL,
  "orderRefundId" TEXT NOT NULL,
  "orderLineItemId" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "quantityRefunded" INTEGER,
  "subtotalRefundedCents" INTEGER NOT NULL,
  "taxRefundedCents" INTEGER NOT NULL DEFAULT 0,
  "tipRefundedCents" INTEGER NOT NULL DEFAULT 0,
  "serviceFeeRefundedCents" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefundLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundLineItem_orderRefundId_idx" ON "RefundLineItem"("orderRefundId");
CREATE INDEX "RefundLineItem_orderLineItemId_idx" ON "RefundLineItem"("orderLineItemId");
CREATE INDEX "RefundLineItem_vendorOrderId_idx" ON "RefundLineItem"("vendorOrderId");

ALTER TABLE "RefundLineItem"
  ADD CONSTRAINT "RefundLineItem_orderRefundId_fkey"
  FOREIGN KEY ("orderRefundId") REFERENCES "OrderRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefundLineItem"
  ADD CONSTRAINT "RefundLineItem_orderLineItemId_fkey"
  FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefundLineItem"
  ADD CONSTRAINT "RefundLineItem_vendorOrderId_fkey"
  FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
