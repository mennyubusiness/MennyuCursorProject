-- Disable Deliverect customer ordering hours sync for all vendors; manual hours are required in vendor UI.
UPDATE "Vendor" SET "syncCustomerOrderingHoursFromDeliverect" = false WHERE "syncCustomerOrderingHoursFromDeliverect" = true;
