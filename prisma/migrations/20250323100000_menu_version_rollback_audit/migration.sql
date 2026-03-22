-- Optional audit link: published row created by rollback points at source MenuVersion snapshot.
ALTER TABLE "MenuVersion" ADD COLUMN "restoredFromMenuVersionId" TEXT;

ALTER TABLE "MenuVersion" ADD CONSTRAINT "MenuVersion_restoredFromMenuVersionId_fkey"
  FOREIGN KEY ("restoredFromMenuVersionId") REFERENCES "MenuVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MenuVersion_vendorId_publishedAt_idx" ON "MenuVersion"("vendorId", "publishedAt" DESC);
