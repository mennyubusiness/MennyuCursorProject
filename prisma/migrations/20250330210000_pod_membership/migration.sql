-- CreateEnum
CREATE TYPE "PodMembershipRole" AS ENUM ('owner', 'manager');

-- CreateTable
CREATE TABLE "PodMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "role" "PodMembershipRole" NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodMembership_userId_podId_key" ON "PodMembership"("userId", "podId");

-- CreateIndex
CREATE INDEX "PodMembership_podId_idx" ON "PodMembership"("podId");

-- CreateIndex
CREATE INDEX "PodMembership_userId_idx" ON "PodMembership"("userId");

-- AddForeignKey
ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
