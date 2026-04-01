-- CreateEnum (idempotent: recover from partial runs that created the type only)
DO $$ BEGIN
    CREATE TYPE "PodMembershipRole" AS ENUM ('owner', 'manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PodMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "role" "PodMembershipRole" NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PodMembership_userId_podId_key" ON "PodMembership"("userId", "podId");

CREATE INDEX IF NOT EXISTS "PodMembership_podId_idx" ON "PodMembership"("podId");

CREATE INDEX IF NOT EXISTS "PodMembership_userId_idx" ON "PodMembership"("userId");

-- AddForeignKey (idempotent if constraints already applied)
DO $$ BEGIN
    ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
