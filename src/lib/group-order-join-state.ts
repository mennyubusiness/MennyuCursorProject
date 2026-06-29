/**
 * Structured join-page state for group orders (by session id or join code).
 */
import "server-only";

import { prisma } from "@/lib/db";
import {
  findOrderIdForGroupOrderSession,
  resolveGroupParticipantForSession,
} from "@/lib/group-participant-order-access";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import {
  expireGroupOrderSessionIfStale,
  expireStaleGroupOrderSessions,
} from "@/lib/group-order-session-lifecycle";
import { parseGroupOrderJoinCodeDigits } from "@/lib/group-order-join-code";

export type GroupOrderJoinState =
  | { kind: "not_found" }
  | { kind: "expired"; podName: string }
  | { kind: "ended"; podName: string }
  | {
      kind: "locked_checkout";
      podName: string;
      participantAccess: boolean;
      podId: string;
      podSlug: string;
    }
  | { kind: "submitted_with_access"; orderId: string }
  | { kind: "submitted_no_access"; podName: string }
  | { kind: "can_join"; sessionId: string; podName: string }
  | { kind: "already_joined"; podId: string; podSlug: string }
  | { kind: "host_view"; podId: string };

export async function resolveGroupOrderJoinState(args: {
  sessionId?: string | null;
  joinCode?: string | null;
  markers: GroupOrderParticipantMarkers;
  hostUserId?: string | null;
}): Promise<GroupOrderJoinState> {
  if (args.joinCode?.trim()) {
    await expireStaleGroupOrderSessions();
  }

  type SessionRow = {
    id: string;
    status: string;
    podId: string;
    cartId: string;
    hostUserId: string;
    pod: { name: string; slug: string };
  };

  let session: SessionRow | null = null;

  const sessionId = args.sessionId?.trim();
  if (sessionId) {
    session = await prisma.groupOrderSession.findUnique({
      where: { id: sessionId },
      include: { pod: { select: { name: true, slug: true } } },
    });
  } else if (args.joinCode?.trim()) {
    const code = parseGroupOrderJoinCodeDigits(args.joinCode);
    if (!code) return { kind: "not_found" };
    session = await prisma.groupOrderSession.findFirst({
      where: { joinCode: code },
      include: { pod: { select: { name: true, slug: true } } },
    });
  }

  if (!session) return { kind: "not_found" };

  await expireGroupOrderSessionIfStale(session.id);

  const fresh = await prisma.groupOrderSession.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      status: true,
      podId: true,
      hostUserId: true,
      pod: { select: { name: true, slug: true } },
    },
  });
  if (!fresh) return { kind: "not_found" };

  const podName = fresh.pod.name;
  const podSlug = fresh.pod.slug;
  const authHostId = args.hostUserId?.trim();
  if (authHostId && authHostId === fresh.hostUserId) {
    return { kind: "host_view", podId: fresh.podId };
  }

  const participant = await resolveGroupParticipantForSession(fresh.id, args.markers);

  switch (fresh.status) {
    case "active":
      if (participant?.role === "participant") {
        return { kind: "already_joined", podId: fresh.podId, podSlug };
      }
      return { kind: "can_join", sessionId: fresh.id, podName };

    case "locked_checkout":
      return {
        kind: "locked_checkout",
        podName,
        participantAccess: participant?.role === "participant",
        podId: fresh.podId,
        podSlug,
      };

    case "submitted": {
      const orderId = await findOrderIdForGroupOrderSession(fresh.id);
      if (participant?.role === "participant" && orderId) {
        return { kind: "submitted_with_access", orderId };
      }
      return { kind: "submitted_no_access", podName };
    }

    case "ended":
      return { kind: "ended", podName };

    case "expired":
      return { kind: "expired", podName };

    default:
      return { kind: "not_found" };
  }
}

export const GROUP_ORDER_JOIN_COPY = {
  notFoundTitle: "Group order not found",
  notFoundBody: "We couldn't find that group order. Check the code and try again.",
  lockedTitle: "Host is checking out",
  lockedBodyNew: "The host is checking out. Joining is paused.",
  lockedBodyExisting: "The host is checking out. You can view the group cart, but new changes are paused.",
  lockedTryAgain: "Try again in a few minutes if checkout doesn't finish.",
  submittedTitle: "Group order placed",
  submittedBody: "This group order has already been placed.",
  submittedNoAccess: "Ask the host for the tracking link.",
  endedTitle: "Group order ended",
  endedBody: "This group order was ended by the host.",
  expiredTitle: "Group order expired",
  expiredBody: "This group order expired. Ask the host to start a new group order.",
  exploreLink: "Explore pods",
} as const;
