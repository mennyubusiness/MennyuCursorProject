-- Optional audit link: published row created by rollback points at source MenuVersion snapshot.
ALTER TABLE "MenuVersion"
ADD COLUMN IF NOT EXISTS "restoredFromMenuVersionId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'MenuVersion_restoredFromMenuVersionId_fkey'
  ) THEN
    ALTER TABLE "MenuVersion"
    ADD CONSTRAINT "MenuVersion_restoredFromMenuVersionId_fkey"
    FOREIGN KEY ("restoredFromMenuVersionId")
    REFERENCES "MenuVersion"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MenuVersion_vendorId_publishedAt_idx"
ON "MenuVersion"("vendorId", "publishedAt" DESC);