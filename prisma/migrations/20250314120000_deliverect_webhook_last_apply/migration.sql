-- Deliverect webhook apply audit (outcome, timestamps, debug)
ALTER TABLE "VendorOrder" ADD COLUMN "deliverectWebhookLastApply" JSONB;
