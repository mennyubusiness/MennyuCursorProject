-- CreateTable
CREATE TABLE "IntegrationProviderCredential" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationProviderCredential_vendorId_provider_idx" ON "IntegrationProviderCredential"("vendorId", "provider");

-- AddForeignKey
ALTER TABLE "IntegrationProviderCredential" ADD CONSTRAINT "IntegrationProviderCredential_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
