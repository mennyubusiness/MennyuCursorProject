-- AlterTable
ALTER TABLE "Pod" ADD COLUMN "pickupTimezone" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "requestedPickupAt" TIMESTAMP(3);
