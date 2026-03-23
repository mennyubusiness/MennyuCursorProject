-- Phase 1 unified auth: User + VendorMembership (foundation for pod/customer/admin roles later)

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TYPE "VendorMembershipRole" AS ENUM ('owner', 'staff');

CREATE TABLE "VendorMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "role" "VendorMembershipRole" NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorMembership_userId_vendorId_key" ON "VendorMembership"("userId", "vendorId");
CREATE INDEX "VendorMembership_vendorId_idx" ON "VendorMembership"("vendorId");
CREATE INDEX "VendorMembership_userId_idx" ON "VendorMembership"("userId");

ALTER TABLE "VendorMembership" ADD CONSTRAINT "VendorMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorMembership" ADD CONSTRAINT "VendorMembership_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
