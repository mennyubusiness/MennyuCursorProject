-- Add Square webhook as a vendor order status source.
ALTER TYPE "VendorOrderStatusSource" ADD VALUE IF NOT EXISTS 'square_webhook';
