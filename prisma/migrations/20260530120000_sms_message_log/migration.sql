-- Transactional SMS audit log (Twilio)
CREATE TABLE "SmsMessageLog" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "vendorOrderId" TEXT,
  "toMasked" TEXT NOT NULL,
  "toLast4" TEXT,
  "eventType" TEXT NOT NULL,
  "bodyPreview" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twilio',
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL,
  "failureMessage" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "SmsMessageLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsMessageLog_idempotencyKey_key" ON "SmsMessageLog"("idempotencyKey");
CREATE INDEX "SmsMessageLog_orderId_idx" ON "SmsMessageLog"("orderId");
CREATE INDEX "SmsMessageLog_vendorOrderId_idx" ON "SmsMessageLog"("vendorOrderId");
CREATE INDEX "SmsMessageLog_eventType_idx" ON "SmsMessageLog"("eventType");
CREATE INDEX "SmsMessageLog_status_idx" ON "SmsMessageLog"("status");

ALTER TABLE "SmsMessageLog"
  ADD CONSTRAINT "SmsMessageLog_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SmsMessageLog"
  ADD CONSTRAINT "SmsMessageLog_vendorOrderId_fkey"
  FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
