-- Twilio SMS infrastructure: notification attempt fields + TCPA opt-out registry
ALTER TABLE "SmsMessageLog" ADD COLUMN "userId" TEXT;
ALTER TABLE "SmsMessageLog" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "SmsMessageLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "SmsMessageLog_providerMessageId_idx" ON "SmsMessageLog"("providerMessageId");

CREATE TABLE "SmsOptOut" (
  "id" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "optedOutAt" TIMESTAMP(3),
  "optedInAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsOptOut_phoneE164_key" ON "SmsOptOut"("phoneE164");
CREATE INDEX "SmsOptOut_optedOutAt_idx" ON "SmsOptOut"("optedOutAt");
