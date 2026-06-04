/**
 * Audit helper: find duplicate participant rows in the same group session.
 * Does not delete or merge — for admin/dev review only.
 */
import "server-only";

import { prisma } from "@/lib/db";

export type DuplicateGroupOrderParticipantGroup = {
  groupOrderSessionId: string;
  phoneE164: string;
  participantIds: string[];
  displayNames: string[];
};

/** Groups with more than one participant row sharing the same phone in one session. */
export async function findDuplicateGroupOrderParticipantsByPhone(): Promise<
  DuplicateGroupOrderParticipantGroup[]
> {
  const rows = await prisma.groupOrderParticipant.findMany({
    where: {
      role: "participant",
      phoneE164: { not: null },
    },
    select: {
      id: true,
      groupOrderSessionId: true,
      phoneE164: true,
      displayName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, DuplicateGroupOrderParticipantGroup>();
  for (const row of rows) {
    const phone = row.phoneE164;
    if (!phone) continue;
    const key = `${row.groupOrderSessionId}\0${phone}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.participantIds.push(row.id);
      existing.displayNames.push(row.displayName);
    } else {
      byKey.set(key, {
        groupOrderSessionId: row.groupOrderSessionId,
        phoneE164: phone,
        participantIds: [row.id],
        displayNames: [row.displayName],
      });
    }
  }

  return [...byKey.values()].filter((g) => g.participantIds.length > 1);
}
