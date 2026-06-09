import "server-only";

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { prisma } from "@/lib/db";
import {
  clearGroupOrderParticipantCookies,
  readGroupOrderParticipantMarkers,
} from "@/lib/group-order-participant-cookie";

const TERMINAL_GROUP_STATUSES = ["submitted", "ended", "expired"] as const;

/**
 * When a signed-in host explicitly starts a group order, drop participant markers that
 * would conflict with host cart resolution. Preserves submitted-tracking cookies for
 * unrelated terminal sessions on other carts.
 */
export async function clearStaleGroupParticipantCookiesForNewHostGroup(
  store: ResponseCookies,
  args: {
    hostUserId: string;
    activeSessionId: string;
    activeSessionCartId: string;
  }
): Promise<{ cleared: boolean }> {
  const markers = readGroupOrderParticipantMarkers(store);
  if (!markers.participantId && !markers.legacyJoinToken) {
    return { cleared: false };
  }

  if (markers.legacyJoinToken?.trim()) {
    clearGroupOrderParticipantCookies(store);
    return { cleared: true };
  }

  const participantId = markers.participantId?.trim();
  if (!participantId) {
    return { cleared: false };
  }

  const row = await prisma.groupOrderParticipant.findUnique({
    where: { id: participantId },
    select: {
      role: true,
      groupOrderSession: {
        select: { id: true, cartId: true, hostUserId: true, status: true },
      },
    },
  });

  if (!row) {
    clearGroupOrderParticipantCookies(store);
    return { cleared: true };
  }

  const session = row.groupOrderSession;

  if (session.id === args.activeSessionId) {
    clearGroupOrderParticipantCookies(store);
    return { cleared: true };
  }

  if (
    TERMINAL_GROUP_STATUSES.includes(
      session.status as (typeof TERMINAL_GROUP_STATUSES)[number]
    )
  ) {
    if (session.cartId === args.activeSessionCartId) {
      clearGroupOrderParticipantCookies(store);
      return { cleared: true };
    }
    return { cleared: false };
  }

  clearGroupOrderParticipantCookies(store);
  return { cleared: true };
}
