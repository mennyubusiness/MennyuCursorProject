-- Group order join idempotency: one participant per phone per session, one row per join attempt key.

ALTER TABLE "GroupOrderParticipant" ADD COLUMN IF NOT EXISTS "joinAttemptKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrderParticipant_groupOrderSessionId_joinAttemptKey_key"
  ON "GroupOrderParticipant"("groupOrderSessionId", "joinAttemptKey");

CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrderParticipant_groupOrderSessionId_phoneE164_key"
  ON "GroupOrderParticipant"("groupOrderSessionId", "phoneE164");
