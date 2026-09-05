-- Stage 2 concierge onboarding: secure ownership claim lifecycle for existing vendors.
--
-- Additive and non-destructive:
--   * Existing vendors and memberships are unchanged.
--   * No menu, ordering, routing, payment, or pod-membership data is mutated.
--   * One row per vendor lets resend/reissue rotate the token and invalidate old links.
--
-- Rollback:
--   DROP TABLE IF EXISTS "VendorClaimInvite";

CREATE TABLE "VendorClaimInvite" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "claimedByUserId" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorClaimInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorClaimInvite_vendorId_key" ON "VendorClaimInvite"("vendorId");
CREATE UNIQUE INDEX "VendorClaimInvite_tokenHash_key" ON "VendorClaimInvite"("tokenHash");
CREATE INDEX "VendorClaimInvite_invitedEmail_idx" ON "VendorClaimInvite"("invitedEmail");
CREATE INDEX "VendorClaimInvite_expiresAt_idx" ON "VendorClaimInvite"("expiresAt");
CREATE INDEX "VendorClaimInvite_invitedByUserId_idx" ON "VendorClaimInvite"("invitedByUserId");
CREATE INDEX "VendorClaimInvite_claimedByUserId_idx" ON "VendorClaimInvite"("claimedByUserId");

ALTER TABLE "VendorClaimInvite"
ADD CONSTRAINT "VendorClaimInvite_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VendorClaimInvite"
ADD CONSTRAINT "VendorClaimInvite_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorClaimInvite"
ADD CONSTRAINT "VendorClaimInvite_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
