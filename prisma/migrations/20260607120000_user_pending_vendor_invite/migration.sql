-- Persist pod-scoped vendor invite for resumable onboarding after tab close / sign-out.
ALTER TABLE "User" ADD COLUMN "pendingVendorInviteId" TEXT;

CREATE UNIQUE INDEX "User_pendingVendorInviteId_key" ON "User"("pendingVendorInviteId");

ALTER TABLE "User" ADD CONSTRAINT "User_pendingVendorInviteId_fkey" FOREIGN KEY ("pendingVendorInviteId") REFERENCES "PodVendorInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
