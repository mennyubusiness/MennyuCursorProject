-- Guarantee at most one active Square connection per vendor.
-- Inactive historical rows remain allowed (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS "VendorIntegrationConnection_one_active_square_per_vendor"
ON "VendorIntegrationConnection" ("vendorId", "provider")
WHERE "isActive" = true AND "provider" = 'square';
