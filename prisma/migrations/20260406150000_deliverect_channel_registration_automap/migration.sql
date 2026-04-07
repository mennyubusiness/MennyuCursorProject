-- PosConnectionStatus: error (automatic channel registration failed / needs attention)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PosConnectionStatus'
      AND e.enumlabel = 'error'
  ) THEN
    ALTER TYPE "PosConnectionStatus" ADD VALUE 'error';
  END IF;
END
$$;

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "pendingDeliverectConnectionKey" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deliverectAutoMapLastOutcome" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deliverectAutoMapLastDetail" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deliverectAutoMapLastAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_pendingDeliverectConnectionKey_key" ON "Vendor"("pendingDeliverectConnectionKey");
