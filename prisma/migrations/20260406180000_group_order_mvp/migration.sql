-- Group order MVP: shared cart session layer (host + participants).
-- Idempotent: safe when enums/tables/columns already exist (partial deploy recovery).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupOrderSessionStatus') THEN
    CREATE TYPE "GroupOrderSessionStatus" AS ENUM ('active', 'locked_checkout', 'submitted', 'ended', 'expired');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupOrderParticipantRole') THEN
    CREATE TYPE "GroupOrderParticipantRole" AS ENUM ('host', 'participant');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GroupOrderSession" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrderSession_joinCode_key" ON "GroupOrderSession"("joinCode");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrderSession_cartId_key" ON "GroupOrderSession"("cartId");
CREATE INDEX IF NOT EXISTS "GroupOrderSession_podId_idx" ON "GroupOrderSession"("podId");
CREATE INDEX IF NOT EXISTS "GroupOrderSession_joinCode_idx" ON "GroupOrderSession"("joinCode");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupOrderSession_podId_fkey'
  ) THEN
    ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupOrderSession_cartId_fkey'
  ) THEN
    ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupOrderSession_hostUserId_fkey'
  ) THEN
    ALTER TABLE "GroupOrderSession" ADD CONSTRAINT "GroupOrderSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GroupOrderParticipant" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrderParticipant_joinToken_key" ON "GroupOrderParticipant"("joinToken");
CREATE INDEX IF NOT EXISTS "GroupOrderParticipant_groupOrderSessionId_idx" ON "GroupOrderParticipant"("groupOrderSessionId");
CREATE INDEX IF NOT EXISTS "GroupOrderParticipant_joinToken_idx" ON "GroupOrderParticipant"("joinToken");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupOrderParticipant_groupOrderSessionId_fkey'
  ) THEN
    ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_groupOrderSessionId_fkey" FOREIGN KEY ("groupOrderSessionId") REFERENCES "GroupOrderSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupOrderParticipant_userId_fkey'
  ) THEN
    ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CartItem' AND column_name = 'groupOrderParticipantId'
  ) THEN
    ALTER TABLE "CartItem" ADD COLUMN "groupOrderParticipantId" TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "CartItem_groupOrderParticipantId_idx" ON "CartItem"("groupOrderParticipantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_groupOrderParticipantId_fkey'
  ) THEN
    ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_groupOrderParticipantId_fkey" FOREIGN KEY ("groupOrderParticipantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'groupOrderSessionId'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "groupOrderSessionId" TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Order_groupOrderSessionId_idx" ON "Order"("groupOrderSessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_groupOrderSessionId_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_groupOrderSessionId_fkey" FOREIGN KEY ("groupOrderSessionId") REFERENCES "GroupOrderSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'OrderLineItem' AND column_name = 'groupOrderParticipantId'
  ) THEN
    ALTER TABLE "OrderLineItem" ADD COLUMN "groupOrderParticipantId" TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "OrderLineItem_groupOrderParticipantId_idx" ON "OrderLineItem"("groupOrderParticipantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderLineItem_groupOrderParticipantId_fkey'
  ) THEN
    ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_groupOrderParticipantId_fkey" FOREIGN KEY ("groupOrderParticipantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
