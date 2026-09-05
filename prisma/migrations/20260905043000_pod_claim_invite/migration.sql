-- Stage 2.5 concierge onboarding: secure ownership claim lifecycle for existing pods.
--
-- Additive and non-destructive:
--   * Existing pods and memberships are unchanged.
--   * No vendor, menu, ordering, routing, payment, or QR data is mutated.
--   * One row per pod lets resend/reissue rotate the token and invalidate old links.
--
-- Rollback:
--   DROP TABLE IF EXISTS "PodClaimInvite";

CREATE TABLE "PodClaimInvite" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
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

    CONSTRAINT "PodClaimInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PodClaimInvite_podId_key" ON "PodClaimInvite"("podId");
CREATE UNIQUE INDEX "PodClaimInvite_tokenHash_key" ON "PodClaimInvite"("tokenHash");
CREATE INDEX "PodClaimInvite_invitedEmail_idx" ON "PodClaimInvite"("invitedEmail");
CREATE INDEX "PodClaimInvite_expiresAt_idx" ON "PodClaimInvite"("expiresAt");
CREATE INDEX "PodClaimInvite_invitedByUserId_idx" ON "PodClaimInvite"("invitedByUserId");
CREATE INDEX "PodClaimInvite_claimedByUserId_idx" ON "PodClaimInvite"("claimedByUserId");

ALTER TABLE "PodClaimInvite"
ADD CONSTRAINT "PodClaimInvite_podId_fkey"
FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PodClaimInvite"
ADD CONSTRAINT "PodClaimInvite_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PodClaimInvite"
ADD CONSTRAINT "PodClaimInvite_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
