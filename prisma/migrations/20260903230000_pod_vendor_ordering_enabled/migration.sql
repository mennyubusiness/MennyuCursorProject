-- Menu-only / orderless support: durable ordering intent on Pod and Vendor.
--
-- Additive and non-destructive:
--   * DEFAULT true, NOT NULL -> every existing pod/vendor stays orderable.
--   * No backfill to false.
--   * No writes to menu data, menu source, routing mode, or payment configuration.
--
-- Rollback:
--   ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "orderingEnabled";
--   ALTER TABLE "Pod" DROP COLUMN IF EXISTS "orderingEnabled";

ALTER TABLE "Pod" ADD COLUMN IF NOT EXISTS "orderingEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "orderingEnabled" BOOLEAN NOT NULL DEFAULT true;
