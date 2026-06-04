-- Inspect duplicate GroupOrderParticipant rows blocking
-- GroupOrderParticipant_groupOrderSessionId_phoneE164_key

SELECT
  "groupOrderSessionId",
  "phoneE164",
  COUNT(*) AS count,
  ARRAY_AGG(id ORDER BY "createdAt") AS participant_ids
FROM "GroupOrderParticipant"
WHERE "phoneE164" IS NOT NULL
GROUP BY "groupOrderSessionId", "phoneE164"
HAVING COUNT(*) > 1;

-- Specific duplicate from migrate deploy error (replace ids as needed):
-- SELECT *
-- FROM "GroupOrderParticipant"
-- WHERE "groupOrderSessionId" = 'cmns73s3j0002lcns2w203icd'
--   AND "phoneE164" = '+15033486843'
-- ORDER BY "createdAt";

-- Line counts per participant id:
-- SELECT p.id, p."createdAt", p."leftAt",
--   (SELECT COUNT(*) FROM "CartItem" c WHERE c."groupOrderParticipantId" = p.id) AS cart_items,
--   (SELECT COUNT(*) FROM "OrderLineItem" o WHERE o."groupOrderParticipantId" = p.id) AS order_lines
-- FROM "GroupOrderParticipant" p
-- WHERE p."groupOrderSessionId" = 'cmns73s3j0002lcns2w203icd'
--   AND p."phoneE164" = '+15033486843'
-- ORDER BY p."createdAt";
