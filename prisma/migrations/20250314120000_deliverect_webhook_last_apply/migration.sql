-- Deliverect webhook apply audit (outcome, timestamps, debug)
-- IF NOT EXISTS: safe when the column was already added (e.g. db push) before this migration ran.
ALTER TABLE "VendorOrder" ADD COLUMN IF NOT EXISTS "deliverectWebhookLastApply" JSONB;
