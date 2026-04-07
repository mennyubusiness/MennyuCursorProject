-- CreateEnum
CREATE TYPE "RegistrationIntent" AS ENUM ('customer', 'vendor', 'pod_owner');

-- CreateEnum
CREATE TYPE "AccountOnboardingStatus" AS ENUM (
  'account_created',
  'profile_incomplete',
  'onboarding_in_progress',
  'ready_for_next_step'
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "registrationIntent" "RegistrationIntent",
ADD COLUMN "needsAccountRoleSelection" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "cuisineCategory" TEXT,
ADD COLUMN "posType" TEXT,
ADD COLUMN "onboardingStatus" "AccountOnboardingStatus" NOT NULL DEFAULT 'ready_for_next_step';

-- AlterTable
ALTER TABLE "Pod" ADD COLUMN "ownerContactName" TEXT,
ADD COLUMN "ownerContactPhone" TEXT,
ADD COLUMN "onboardingStatus" "AccountOnboardingStatus" NOT NULL DEFAULT 'ready_for_next_step';
