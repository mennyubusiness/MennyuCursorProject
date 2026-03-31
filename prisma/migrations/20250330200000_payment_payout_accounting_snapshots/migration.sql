-- Payout accounting snapshots: Stripe fee on Payment; gross / allocated / net on PaymentAllocation.

ALTER TABLE "Payment" ADD COLUMN "stripeProcessingFeeCents" INTEGER;

ALTER TABLE "PaymentAllocation" ADD COLUMN "grossVendorPayableCents" INTEGER;
ALTER TABLE "PaymentAllocation" ADD COLUMN "allocatedProcessingFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentAllocation" ADD COLUMN "netVendorTransferCents" INTEGER;

UPDATE "PaymentAllocation" AS pa
SET
  "grossVendorPayableCents" = v."subtotalCents" + v."taxCents" + v."tipCents",
  "netVendorTransferCents" = v."subtotalCents" + v."taxCents" + v."tipCents"
FROM "VendorOrder" AS v
WHERE pa."vendorOrderId" = v."id";

ALTER TABLE "PaymentAllocation" ALTER COLUMN "grossVendorPayableCents" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "netVendorTransferCents" SET NOT NULL;
