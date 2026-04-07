-- Enum may already exist if a previous deploy attempt failed after CREATE TYPE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PosConnectionStatus') THEN
    CREATE TYPE "PosConnectionStatus" AS ENUM ('not_connected', 'onboarding', 'connected');
  END IF;
END
$$;

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deliverectAccountEmail" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "posProvider" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "locationSummary" TEXT;

-- Add posConnectionStatus only when missing (type must exist).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Vendor'
      AND column_name = 'posConnectionStatus'
  ) THEN
    ALTER TABLE "Vendor"
      ADD COLUMN "posConnectionStatus" "PosConnectionStatus" NOT NULL DEFAULT 'not_connected';
  END IF;
END
$$;

UPDATE "Vendor"
SET "posConnectionStatus" = 'connected'
WHERE "deliverectChannelLinkId" IS NOT NULL
  AND trim("deliverectChannelLinkId") <> ''
  AND "posConnectionStatus" IS DISTINCT FROM 'connected';
