/**
 * Group order session lifecycle: explicit expiration and join-code normalization.
 */
import "server-only";

import type { GroupOrderSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeGroupOrderJoinCode } from "@/lib/group-order-join-code";

const EXPIRABLE_STATUSES: GroupOrderSessionStatus[] = ["active", "locked_checkout"];

export { normalizeGroupOrderJoinCode };

/**
 * Mark all stale open sessions as expired. Safe to run repeatedly.
 * Does not touch submitted or ended sessions.
 */
export async function expireStaleGroupOrderSessions(now = new Date()): Promise<number> {
  const result = await prisma.groupOrderSession.updateMany({
    where: {
      status: { in: EXPIRABLE_STATUSES },
      expiresAt: { lt: now },
    },
    data: { status: "expired", lockedAt: null },
  });
  return result.count;
}

/**
 * Expire a single session when past expiresAt and still open.
 * Returns whether the row was transitioned to expired.
 */
export async function expireGroupOrderSessionIfStale(
  sessionId: string,
  now = new Date()
): Promise<"expired" | "unchanged" | "not_found"> {
  const s = await prisma.groupOrderSession.findUnique({
    where: { id: sessionId },
    select: { status: true, expiresAt: true },
  });
  if (!s) return "not_found";
  if (!EXPIRABLE_STATUSES.includes(s.status)) return "unchanged";
  if (s.expiresAt >= now) return "unchanged";
  await prisma.groupOrderSession.update({
    where: { id: sessionId },
    data: { status: "expired", lockedAt: null },
  });
  return "expired";
}
