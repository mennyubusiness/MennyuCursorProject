-- Deliverect prep-time ETA (inbound). Separate from customer scheduled pickup (`requestedPickupAt`).
ALTER TABLE "Order" ADD COLUMN "deliverectEstimatedReadyAt" TIMESTAMP(3);
