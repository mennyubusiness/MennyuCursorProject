-- Vendor customer-facing ordering hours (custom or synced from Deliverect/POS).
ALTER TABLE "Vendor" ADD COLUMN "syncCustomerOrderingHoursFromDeliverect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN "customerOrderingHours" JSONB;
ALTER TABLE "Vendor" ADD COLUMN "deliverectSyncedCustomerOrderingHours" JSONB;
ALTER TABLE "Vendor" ADD COLUMN "deliverectSyncedCustomerOrderingHoursAt" TIMESTAMP(3);
