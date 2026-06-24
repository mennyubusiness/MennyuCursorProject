-- Pod owner payout settings and per-payment allocation records (P1: calculation only, no Stripe transfers).

CREATE TABLE "PodPayoutSettings" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "podPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "podRevenueShareBps" INTEGER NOT NULL DEFAULT 0,
    "podPayoutRecipientUserId" TEXT,
    "minimumPayoutCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodPayoutSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PodPayoutSettings_podId_key" ON "PodPayoutSettings"("podId");
CREATE INDEX "PodPayoutSettings_podPayoutRecipientUserId_idx" ON "PodPayoutSettings"("podPayoutRecipientUserId");

CREATE TABLE "PodPayoutAllocation" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eligibleSubtotalCents" INTEGER NOT NULL,
    "eligibleSubtotalCentsAfterRefunds" INTEGER,
    "revenueShareBps" INTEGER NOT NULL,
    "podPayoutAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "blockedReason" TEXT,
    "podPayoutRecipientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodPayoutAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PodPayoutAllocation_paymentId_key" ON "PodPayoutAllocation"("paymentId");
CREATE INDEX "PodPayoutAllocation_podId_createdAt_idx" ON "PodPayoutAllocation"("podId", "createdAt");
CREATE INDEX "PodPayoutAllocation_status_idx" ON "PodPayoutAllocation"("status");
CREATE INDEX "PodPayoutAllocation_podId_status_idx" ON "PodPayoutAllocation"("podId", "status");
CREATE INDEX "PodPayoutAllocation_orderId_idx" ON "PodPayoutAllocation"("orderId");

ALTER TABLE "PodPayoutSettings" ADD CONSTRAINT "PodPayoutSettings_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PodPayoutSettings" ADD CONSTRAINT "PodPayoutSettings_podPayoutRecipientUserId_fkey" FOREIGN KEY ("podPayoutRecipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PodPayoutAllocation" ADD CONSTRAINT "PodPayoutAllocation_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PodPayoutAllocation" ADD CONSTRAINT "PodPayoutAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PodPayoutAllocation" ADD CONSTRAINT "PodPayoutAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PodPayoutAllocation" ADD CONSTRAINT "PodPayoutAllocation_podPayoutRecipientUserId_fkey" FOREIGN KEY ("podPayoutRecipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
