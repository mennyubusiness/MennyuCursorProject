-- Sprint 2: pod ordering pause + slug redirects
ALTER TABLE "Pod" ADD COLUMN "mennyuOrdersPaused" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdByAdminUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlugRedirect_oldSlug_key" ON "SlugRedirect"("oldSlug");
CREATE INDEX "SlugRedirect_entityType_entityId_idx" ON "SlugRedirect"("entityType", "entityId");
CREATE INDEX "SlugRedirect_newSlug_idx" ON "SlugRedirect"("newSlug");

ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
