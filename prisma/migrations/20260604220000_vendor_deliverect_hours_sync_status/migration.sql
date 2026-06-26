-- Deliverect customer ordering hours sync status (last fetch outcome).
ALTER TABLE "Vendor" ADD COLUMN "deliverectSyncedCustomerOrderingHoursSyncStatus" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "deliverectSyncedCustomerOrderingHoursLastError" TEXT;
