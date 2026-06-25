-- CreateTable
CREATE TABLE "PodVendorInvite" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedVendorName" TEXT,
    "invitedContactName" TEXT,
    "invitedPhone" TEXT,
    "note" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "acceptedVendorId" TEXT,
    "targetVendorId" TEXT,
    "membershipRequestId" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodVendorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodVendorInvite_tokenHash_key" ON "PodVendorInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "PodVendorInvite_podId_status_idx" ON "PodVendorInvite"("podId", "status");

-- CreateIndex
CREATE INDEX "PodVendorInvite_invitedEmail_idx" ON "PodVendorInvite"("invitedEmail");

-- CreateIndex
CREATE INDEX "PodVendorInvite_podId_invitedEmail_status_idx" ON "PodVendorInvite"("podId", "invitedEmail", "status");

-- AddForeignKey
ALTER TABLE "PodVendorInvite" ADD CONSTRAINT "PodVendorInvite_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodVendorInvite" ADD CONSTRAINT "PodVendorInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodVendorInvite" ADD CONSTRAINT "PodVendorInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodVendorInvite" ADD CONSTRAINT "PodVendorInvite_acceptedVendorId_fkey" FOREIGN KEY ("acceptedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodVendorInvite" ADD CONSTRAINT "PodVendorInvite_targetVendorId_fkey" FOREIGN KEY ("targetVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
