-- CreateTable
CREATE TABLE "PodMembershipRequest" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PodMembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodMembershipRequest_podId_idx" ON "PodMembershipRequest"("podId");

-- CreateIndex
CREATE INDEX "PodMembershipRequest_vendorId_idx" ON "PodMembershipRequest"("vendorId");

-- CreateIndex
CREATE INDEX "PodMembershipRequest_vendorId_status_idx" ON "PodMembershipRequest"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "PodMembershipRequest" ADD CONSTRAINT "PodMembershipRequest_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMembershipRequest" ADD CONSTRAINT "PodMembershipRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
