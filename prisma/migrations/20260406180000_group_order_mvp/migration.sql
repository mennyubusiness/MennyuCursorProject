-- Group order MVP: shared cart session layer (host + participants).

CREATE TYPE "GroupOrderSessionStatus" AS ENUM ('active', 'locked_checkout', 'submitted', 'ended', 'expired');
CREATE TYPE "GroupOrderParticipantRole" AS ENUM ('host', 'participant');

CREATE TABLE "GroupOrderSession" (
    "id" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "status" "GroupOrderSessionStatus" NOT NULL DEFAULT 'active',
    "lockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrderSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupOrderSession_joinCode_key" ON "GroupOrderSession"("joinCode");
CREATE UNIQUE INDEX "GroupOrderSession_cartId_key" ON "GroupOrderSession"("cartId");
CREATE INDEX "GroupOrderSession_podId_idx" ON "GroupOrderSession"("podId");
CREATE INDEX "GroupOrderSession_joinCode_idx" ON "GroupOrderSession"("joinCode");

ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GroupOrderParticipant" (
    "id" TEXT NOT NULL,
    "groupOrderSessionId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "GroupOrderParticipantRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "joinToken" TEXT NOT NULL,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrderParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupOrderParticipant_joinToken_key" ON "GroupOrderParticipant"("joinToken");
CREATE INDEX "GroupOrderParticipant_groupOrderSessionId_idx" ON "GroupOrderParticipant"("groupOrderSessionId");
CREATE INDEX "GroupOrderParticipant_joinToken_idx" ON "GroupOrderParticipant"("joinToken");

ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_groupOrderSessionId_fkey" FOREIGN KEY ("groupOrderSessionId") REFERENCES "GroupOrderSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD COLUMN "groupOrderParticipantId" TEXT;
CREATE INDEX "CartItem_groupOrderParticipantId_idx" ON "CartItem"("groupOrderParticipantId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_groupOrderParticipantId_fkey" FOREIGN KEY ("groupOrderParticipantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "groupOrderSessionId" TEXT;
CREATE INDEX "Order_groupOrderSessionId_idx" ON "Order"("groupOrderSessionId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_groupOrderSessionId_fkey" FOREIGN KEY ("groupOrderSessionId") REFERENCES "GroupOrderSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderLineItem" ADD COLUMN "groupOrderParticipantId" TEXT;
CREATE INDEX "OrderLineItem_groupOrderParticipantId_idx" ON "OrderLineItem"("groupOrderParticipantId");
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_groupOrderParticipantId_fkey" FOREIGN KEY ("groupOrderParticipantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
