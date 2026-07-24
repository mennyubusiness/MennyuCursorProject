-- Phase 2 additive menu architecture fields (reversible).
-- Rollback: see docs/reports/menu-architecture-phase2-migration.md

-- MenuImportJob: generic source location (keep deliverectLocationId for legacy dual-read)
ALTER TABLE "MenuImportJob" ADD COLUMN IF NOT EXISTS "sourceLocationId" TEXT;

CREATE INDEX IF NOT EXISTS "MenuImportJob_sourceLocationId_idx" ON "MenuImportJob"("sourceLocationId");

-- Safe backfill: Square catalog pulls — location in deliverectLocationId is unambiguously Square
UPDATE "MenuImportJob"
SET "sourceLocationId" = "deliverectLocationId"
WHERE "source" = 'SQUARE_CATALOG_PULL'
  AND "sourceLocationId" IS NULL
  AND "deliverectLocationId" IS NOT NULL
  AND TRIM("deliverectLocationId") <> '';

-- Safe backfill: Deliverect ingest sources — location column is Deliverect location
UPDATE "MenuImportJob"
SET "sourceLocationId" = "deliverectLocationId"
WHERE "source" IN (
  'DELIVERECT_MENU_WEBHOOK',
  'DELIVERECT_API_PULL'
)
  AND "sourceLocationId" IS NULL
  AND "deliverectLocationId" IS NOT NULL
  AND TRIM("deliverectLocationId") <> '';

-- ProviderEntityMapping: hybrid ExternalMenuMapping additive columns
ALTER TABLE "ProviderEntityMapping" ADD COLUMN IF NOT EXISTS "environment" TEXT;
ALTER TABLE "ProviderEntityMapping" ADD COLUMN IF NOT EXISTS "externalParentId" TEXT;
ALTER TABLE "ProviderEntityMapping" ADD COLUMN IF NOT EXISTS "externalAccountId" TEXT;
ALTER TABLE "ProviderEntityMapping" ADD COLUMN IF NOT EXISTS "externalVersion" TEXT;
ALTER TABLE "ProviderEntityMapping" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "ProviderEntityMapping_vendorId_provider_externalParentId_idx"
  ON "ProviderEntityMapping"("vendorId", "provider", "externalParentId");
