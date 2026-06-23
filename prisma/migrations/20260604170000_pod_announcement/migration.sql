-- Pod owner announcement / promo message for public pod page.
ALTER TABLE "Pod"
ADD COLUMN "announcementText" TEXT,
ADD COLUMN "announcementIsActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "announcementUpdatedAt" TIMESTAMP(3);
