-- CreateEnum
CREATE TYPE "MenuImportSource" AS ENUM ('DELIVERECT_API_PULL', 'DELIVERECT_MENU_WEBHOOK');

-- CreateEnum
CREATE TYPE "MenuImportJobStatus" AS ENUM ('queued', 'fetching', 'ingested', 'normalizing', 'validating', 'awaiting_review', 'publishing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "MenuImportIssueSeverity" AS ENUM ('blocking', 'warning', 'info');

-- CreateEnum
CREATE TYPE "MenuImportIssueKind" AS ENUM ('normalization', 'validation');

-- CreateEnum
CREATE TYPE "MenuVersionState" AS ENUM ('draft', 'published', 'archived', 'superseded');

-- CreateTable
CREATE TABLE "MenuVersion" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "state" "MenuVersionState" NOT NULL DEFAULT 'draft',
    "canonicalSnapshot" JSONB NOT NULL,
    "canonicalSnapshotSha256" TEXT NOT NULL,
    "previousPublishedVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuImportJob" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "source" "MenuImportSource" NOT NULL,
    "status" "MenuImportJobStatus" NOT NULL DEFAULT 'queued',
    "deliverectChannelLinkId" TEXT,
    "deliverectLocationId" TEXT,
    "deliverectMenuId" TEXT,
    "idempotencyKey" TEXT,
    "draftVersionId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "MenuImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuImportRawPayload" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "deliverectApiVersion" TEXT,
    "payload" JSONB NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuImportRawPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuImportIssue" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "MenuImportIssueKind" NOT NULL,
    "severity" "MenuImportIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityPath" TEXT,
    "deliverectId" TEXT,
    "mennyuEntityType" TEXT,
    "mennyuEntityId" TEXT,
    "details" JSONB,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "waivedBy" TEXT,
    "waivedAt" TIMESTAMP(3),

    CONSTRAINT "MenuImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuImportJob_idempotencyKey_key" ON "MenuImportJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MenuImportJob_draftVersionId_key" ON "MenuImportJob"("draftVersionId");

-- CreateIndex
CREATE INDEX "MenuImportJob_vendorId_status_idx" ON "MenuImportJob"("vendorId", "status");

-- CreateIndex
CREATE INDEX "MenuImportJob_vendorId_startedAt_idx" ON "MenuImportJob"("vendorId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MenuImportRawPayload_jobId_key" ON "MenuImportRawPayload"("jobId");

-- CreateIndex
CREATE INDEX "MenuImportRawPayload_payloadSha256_idx" ON "MenuImportRawPayload"("payloadSha256");

-- CreateIndex
CREATE INDEX "MenuImportIssue_jobId_idx" ON "MenuImportIssue"("jobId");

-- CreateIndex
CREATE INDEX "MenuImportIssue_jobId_severity_idx" ON "MenuImportIssue"("jobId", "severity");

-- CreateIndex
CREATE INDEX "MenuVersion_vendorId_state_idx" ON "MenuVersion"("vendorId", "state");

-- CreateIndex
CREATE INDEX "MenuVersion_vendorId_createdAt_idx" ON "MenuVersion"("vendorId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MenuVersion" ADD CONSTRAINT "MenuVersion_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuVersion" ADD CONSTRAINT "MenuVersion_previousPublishedVersionId_fkey" FOREIGN KEY ("previousPublishedVersionId") REFERENCES "MenuVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImportJob" ADD CONSTRAINT "MenuImportJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImportJob" ADD CONSTRAINT "MenuImportJob_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "MenuVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImportRawPayload" ADD CONSTRAINT "MenuImportRawPayload_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MenuImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImportIssue" ADD CONSTRAINT "MenuImportIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MenuImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
