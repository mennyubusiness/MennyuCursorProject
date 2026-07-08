-- CreateTable
CREATE TABLE "IntegrationOAuthStateNonce" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationOAuthStateNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOAuthStateNonce_nonce_key" ON "IntegrationOAuthStateNonce"("nonce");

-- CreateIndex
CREATE INDEX "IntegrationOAuthStateNonce_expiresAt_idx" ON "IntegrationOAuthStateNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationOAuthStateNonce_vendorId_idx" ON "IntegrationOAuthStateNonce"("vendorId");

-- AddForeignKey
ALTER TABLE "IntegrationOAuthStateNonce" ADD CONSTRAINT "IntegrationOAuthStateNonce_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
