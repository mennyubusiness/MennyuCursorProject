/**
 * Resolve active group-order participant from durable cookies (participant id, legacy token).
 */
import "server-only";

import { prisma } from "@/lib/db";
import type { GroupOrderSessionStatus } from "@prisma/client";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";

const ACTIVE_GROUP_STATUSES: GroupOrderSessionStatus[] = ["active", "locked_checkout"];

export type ActiveGroupParticipantBinding = {
  participantId: string;
  cartId: string;
  podId: string;
  sessionId: string;
  sessionStatus: GroupOrderSessionStatus;
};

export async function resolveActiveGroupParticipantBinding(
  markers: GroupOrderParticipantMarkers
): Promise<ActiveGroupParticipantBinding | null> {
  const participantId = markers.participantId?.trim();
  if (participantId) {
    const byId = await prisma.groupOrderParticipant.findFirst({
      where: {
        id: participantId,
        role: "participant",
        leftAt: null,
        groupOrderSession: {
          status: { in: ACTIVE_GROUP_STATUSES },
          expiresAt: { gt: new Date() },
        },
      },
      select: {
        id: true,
        groupOrderSession: {
          select: { id: true, cartId: true, podId: true, status: true },
        },
      },
    });
    if (byId) {
      return {
        participantId: byId.id,
        cartId: byId.groupOrderSession.cartId,
        podId: byId.groupOrderSession.podId,
        sessionId: byId.groupOrderSession.id,
        sessionStatus: byId.groupOrderSession.status,
      };
    }
  }

  const legacy = markers.legacyJoinToken?.trim();
  if (!legacy) return null;

  const byToken = await prisma.groupOrderParticipant.findFirst({
    where: {
      joinToken: legacy,
      role: "participant",
      leftAt: null,
      groupOrderSession: {
        status: { in: ACTIVE_GROUP_STATUSES },
        expiresAt: { gt: new Date() },
      },
    },
    select: {
      id: true,
      groupOrderSession: {
        select: { id: true, cartId: true, podId: true, status: true },
      },
    },
  });
  if (!byToken) return null;

  return {
    participantId: byToken.id,
    cartId: byToken.groupOrderSession.cartId,
    podId: byToken.groupOrderSession.podId,
    sessionId: byToken.groupOrderSession.id,
    sessionStatus: byToken.groupOrderSession.status,
  };
}
