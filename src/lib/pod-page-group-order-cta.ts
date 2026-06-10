import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { resolveGroupParticipantForSession } from "@/lib/group-participant-order-access";
import { expireGroupOrderSessionIfStale } from "@/lib/group-order-session-lifecycle";
import {
  findSessionByCartId,
  resolveActiveGroupCartIdForPod,
  resolveActorForGroupCart,
} from "@/services/group-order.service";

export type PodPageGroupOrderCtaState =
  | { kind: "start" }
  | { kind: "host_active" }
  | { kind: "participant_active" }
  | { kind: "locked_checkout" };

const IN_FLOW_STATUSES = ["active", "locked_checkout"] as const;

export async function resolvePodPageGroupOrderCtaState(
  podId: string,
  opts: {
    hostUserId: string | null;
    participantMarkers: GroupOrderParticipantMarkers;
  }
): Promise<PodPageGroupOrderCtaState> {
  const cartId = await resolveActiveGroupCartIdForPod(podId, {
    markers: opts.participantMarkers,
    hostUserId: opts.hostUserId,
  });
  if (!cartId) return { kind: "start" };

  let session = await findSessionByCartId(cartId);
  if (!session || session.podId !== podId) return { kind: "start" };

  if (IN_FLOW_STATUSES.includes(session.status as (typeof IN_FLOW_STATUSES)[number])) {
    await expireGroupOrderSessionIfStale(session.id);
    session = await findSessionByCartId(cartId);
    if (!session || session.podId !== podId) return { kind: "start" };
  }

  if (!IN_FLOW_STATUSES.includes(session.status as (typeof IN_FLOW_STATUSES)[number])) {
    return { kind: "start" };
  }

  const hostId = opts.hostUserId?.trim();
  if (hostId && session.hostUserId === hostId) {
    return session.status === "locked_checkout"
      ? { kind: "locked_checkout" }
      : { kind: "host_active" };
  }

  const participant = await resolveGroupParticipantForSession(session.id, opts.participantMarkers);
  if (participant?.role === "participant" && !participant.leftAt) {
    return session.status === "locked_checkout"
      ? { kind: "locked_checkout" }
      : { kind: "participant_active" };
  }

  const actor = await resolveActorForGroupCart(cartId, {
    hostUserId: hostId ?? null,
    participantIdFromCookie: opts.participantMarkers.participantId,
    joinTokenFromCookie: opts.participantMarkers.legacyJoinToken,
  });
  if (actor?.role === "participant") {
    return session.status === "locked_checkout"
      ? { kind: "locked_checkout" }
      : { kind: "participant_active" };
  }

  return { kind: "start" };
}

/** Convenience for pod page Server Components. */
export async function getPodPageGroupOrderCtaState(podId: string): Promise<PodPageGroupOrderCtaState> {
  const [authSession, cookieStore] = await Promise.all([auth(), cookies()]);
  return resolvePodPageGroupOrderCtaState(podId, {
    hostUserId: authSession?.user?.id ?? null,
    participantMarkers: readGroupOrderParticipantMarkers(cookieStore),
  });
}
