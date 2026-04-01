-- AlterTable (IF NOT EXISTS avoids failure if column already applied manually)
ALTER TABLE "ModifierOption" ADD COLUMN IF NOT EXISTS "deliverectModifierPlu" TEXT;
