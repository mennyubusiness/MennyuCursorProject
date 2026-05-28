-- Vendor visibility and response on customer OrderIssue rows
ALTER TABLE "OrderIssue" ADD COLUMN "vendorResponse" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "vendorRespondedAt" TIMESTAMP(3);
ALTER TABLE "OrderIssue" ADD COLUMN "vendorRespondedByUserId" TEXT;
ALTER TABLE "OrderIssue" ADD COLUMN "vendorIssueStatus" TEXT;

CREATE INDEX "OrderIssue_vendorIssueStatus_idx" ON "OrderIssue"("vendorIssueStatus");
