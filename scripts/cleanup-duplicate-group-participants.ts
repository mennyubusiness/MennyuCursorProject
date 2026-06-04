/**
 * One-off: merge duplicate GroupOrderParticipant rows (same groupOrderSessionId + phoneE164)
 * so the join idempotency migration can apply unique indexes.
 *
 * Does not log or export joinToken.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-group-participants.ts           # dry-run (default)
 *   npx tsx scripts/cleanup-duplicate-group-participants.ts --apply     # mutate database
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  duplicateParticipantIdsToRemove,
  findDuplicateGroupOrderParticipantsByPhone,
  pickKeeperParticipantId,
  type ParticipantMergeCandidate,
} from "../src/lib/group-order-participant-merge";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function loadCandidates(participantIds: string[]): Promise<ParticipantMergeCandidate[]> {
  const rows = await prisma.groupOrderParticipant.findMany({
    where: { id: { in: participantIds } },
    select: {
      id: true,
      createdAt: true,
      leftAt: true,
      displayName: true,
      _count: {
        select: {
          cartItems: true,
          orderLineItems: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    leftAt: r.leftAt,
    displayName: r.displayName,
    cartItemCount: r._count.cartItems,
    orderLineItemCount: r._count.orderLineItems,
  }));
}

async function mergeGroup(
  groupOrderSessionId: string,
  phoneE164: string,
  participantIds: string[]
): Promise<void> {
  const candidates = await loadCandidates(participantIds);
  const keeperId = pickKeeperParticipantId(candidates);
  const removeIds = duplicateParticipantIdsToRemove(candidates, keeperId);

  console.log("[cleanup-duplicate-group-participants] group", {
    groupOrderSessionId,
    phoneE164,
    keeperId,
    removeIds,
    candidates: candidates.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      leftAt: c.leftAt?.toISOString() ?? null,
      cartItemCount: c.cartItemCount,
      orderLineItemCount: c.orderLineItemCount,
    })),
  });

  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    if (removeIds.length > 0) {
      const cartUpdated = await tx.cartItem.updateMany({
        where: { groupOrderParticipantId: { in: removeIds } },
        data: { groupOrderParticipantId: keeperId },
      });
      const orderUpdated = await tx.orderLineItem.updateMany({
        where: { groupOrderParticipantId: { in: removeIds } },
        data: { groupOrderParticipantId: keeperId },
      });
      console.log("[cleanup-duplicate-group-participants] reassigned lines", {
        keeperId,
        cartItemsUpdated: cartUpdated.count,
        orderLineItemsUpdated: orderUpdated.count,
      });

      const deleted = await tx.groupOrderParticipant.deleteMany({
        where: { id: { in: removeIds } },
      });
      console.log("[cleanup-duplicate-group-participants] deleted participants", {
        count: deleted.count,
        ids: removeIds,
      });
    }
  });
}

async function assertNoPhoneDuplicates(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT "groupOrderSessionId", "phoneE164"
      FROM "GroupOrderParticipant"
      WHERE "phoneE164" IS NOT NULL
      GROUP BY "groupOrderSessionId", "phoneE164"
      HAVING COUNT(*) > 1
    ) dupes
  `;
  return Number(rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  console.log("[cleanup-duplicate-group-participants] mode", APPLY ? "APPLY" : "DRY-RUN");

  const dupes = await findDuplicateGroupOrderParticipantsByPhone();
  if (dupes.length === 0) {
    console.log("[cleanup-duplicate-group-participants] no duplicate phone groups found");
  } else {
    console.log("[cleanup-duplicate-group-participants] found", dupes.length, "duplicate group(s)");
    for (const g of dupes) {
      await mergeGroup(g.groupOrderSessionId, g.phoneE164, g.participantIds);
    }
  }

  const remaining = await assertNoPhoneDuplicates();
  console.log("[cleanup-duplicate-group-participants] remaining duplicate phone groups", remaining);

  if (remaining > 0) {
    process.exitCode = 1;
    return;
  }

  if (!APPLY && dupes.length > 0) {
    console.log("[cleanup-duplicate-group-participants] re-run with --apply to mutate");
  }
}

main()
  .catch((e) => {
    console.error("[cleanup-duplicate-group-participants] fatal", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
