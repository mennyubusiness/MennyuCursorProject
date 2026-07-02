-- Soft deletion / deactivation timestamps for user, vendor, and pod entities.

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "Vendor" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Vendor" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "Pod" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Pod" ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");
CREATE INDEX "Pod_deletedAt_idx" ON "Pod"("deletedAt");
