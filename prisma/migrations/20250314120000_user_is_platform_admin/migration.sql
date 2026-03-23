-- Platform admin flag on unified User model (NextAuth session).
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
