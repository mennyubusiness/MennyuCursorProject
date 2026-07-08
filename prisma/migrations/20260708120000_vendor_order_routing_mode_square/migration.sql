-- Add Square as an admin-selectable order routing mode.
ALTER TYPE "VendorOrderRoutingMode" ADD VALUE IF NOT EXISTS 'square';
