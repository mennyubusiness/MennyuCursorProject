/**
 * Helpers to merge duplicate GroupOrderParticipant rows (same session + phone).
 */

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

export type ParticipantMergeCandidate = {
  id: string;
  createdAt: Date;
  leftAt: Date | null;
  displayName: string;
  cartItemCount: number;
  orderLineItemCount: number;
};

/** Prefer the row that owns the most lines; tie-break active > oldest createdAt. */
export function pickKeeperParticipantId(candidates: ParticipantMergeCandidate[]): string {
  if (candidates.length === 0) {
    throw new Error("pickKeeperParticipantId requires at least one candidate");
  }
  const sorted = [...candidates].sort((a, b) => {
    const aLines = a.cartItemCount + a.orderLineItemCount;
    const bLines = b.cartItemCount + b.orderLineItemCount;
    if (bLines !== aLines) return bLines - aLines;
    const aActive = a.leftAt == null ? 1 : 0;
    const bActive = b.leftAt == null ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]!.id;
}

export function duplicateParticipantIdsToRemove(
  candidates: ParticipantMergeCandidate[],
  keeperId: string
): string[] {
  return candidates.filter((c) => c.id !== keeperId).map((c) => c.id);
}
