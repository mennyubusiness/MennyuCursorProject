-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('manual_dashboard', 'open_order', 'deliverect', 'square', 'toast', 'clover', 'lightspeed');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('not_configured', 'pending', 'connected', 'error', 'disconnected');

-- CreateEnum
CREATE TYPE "IntegrationCapability" AS ENUM ('menu_import', 'menu_publish', 'order_injection', 'order_status_webhooks', 'inventory_availability', 'hours_sync', 'price_sync', 'external_order_lookup', 'payments', 'refunds');

-- CreateEnum
CREATE TYPE "ProviderEntityType" AS ENUM ('menu_item', 'modifier_group', 'modifier_option', 'category', 'vendor_order');

-- CreateEnum
CREATE TYPE "ProviderWebhookProcessingStatus" AS ENUM ('received', 'processed', 'ignored', 'failed');

-- CreateTable
CREATE TABLE "VendorIntegrationConnection" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'not_configured',
    "displayName" TEXT,
    "externalAccountId" TEXT,
    "externalMerchantId" TEXT,
    "externalLocationId" TEXT,
    "externalStoreId" TEXT,
    "accessTokenRef" TEXT,
    "refreshTokenRef" TEXT,
    "capabilities" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorIntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEntityMapping" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "connectionId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "internalEntityType" "ProviderEntityType" NOT NULL,
    "internalEntityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalLocationId" TEXT,
    "externalPayloadHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderEntityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "connectionId" TEXT,
    "vendorId" TEXT,
    "externalEventId" TEXT,
    "externalObjectId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT,
    "sanitizedPayloadJson" JSONB,
    "processingStatus" "ProviderWebhookProcessingStatus" NOT NULL DEFAULT 'received',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "relatedOrderId" TEXT,
    "relatedVendorOrderId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorIntegrationConnection_vendorId_provider_idx" ON "VendorIntegrationConnection"("vendorId", "provider");

-- CreateIndex
CREATE INDEX "VendorIntegrationConnection_vendorId_provider_isActive_idx" ON "VendorIntegrationConnection"("vendorId", "provider", "isActive");

-- CreateIndex
CREATE INDEX "VendorIntegrationConnection_provider_externalLocationId_idx" ON "VendorIntegrationConnection"("provider", "externalLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEntityMapping_vendorId_provider_internalEntityType_internalEntityId_externalLocationId_key" ON "ProviderEntityMapping"("vendorId", "provider", "internalEntityType", "internalEntityId", "externalLocationId");

-- CreateIndex
CREATE INDEX "ProviderEntityMapping_provider_externalId_idx" ON "ProviderEntityMapping"("provider", "externalId");

-- CreateIndex
CREATE INDEX "ProviderEntityMapping_vendorId_provider_internalEntityType_idx" ON "ProviderEntityMapping"("vendorId", "provider", "internalEntityType");

-- CreateIndex
CREATE INDEX "ProviderEntityMapping_connectionId_idx" ON "ProviderEntityMapping"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_externalEventId_key" ON "ProviderWebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_provider_processingStatus_receivedAt_idx" ON "ProviderWebhookEvent"("provider", "processingStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_vendorId_receivedAt_idx" ON "ProviderWebhookEvent"("vendorId", "receivedAt");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_connectionId_receivedAt_idx" ON "ProviderWebhookEvent"("connectionId", "receivedAt");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_relatedVendorOrderId_idx" ON "ProviderWebhookEvent"("relatedVendorOrderId");

-- AddForeignKey
ALTER TABLE "VendorIntegrationConnection" ADD CONSTRAINT "VendorIntegrationConnection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEntityMapping" ADD CONSTRAINT "ProviderEntityMapping_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEntityMapping" ADD CONSTRAINT "ProviderEntityMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "VendorIntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "VendorIntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
