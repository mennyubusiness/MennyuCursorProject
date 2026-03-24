-- Order-level notes for admin resolution workflow (shared across issues on this order).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adminResolutionNotes" TEXT;
