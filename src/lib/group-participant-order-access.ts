/**
 * Read-only post-checkout access for group order participants (cookie-based, no joinToken exposure).
 */
import "server-only";

import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { prisma } from "@/lib/db";
import {
  readGroupOrderParticipantMarkers,
  type GroupOrderParticipantMarkers,
} from "@/lib/group-order-participant-cookie";

export type ResolvedGroupParticipant = {
  id: string;
  role: "host" | "participant";
  displayName: string;
  groupOrderSessionId: string;
  leftAt: Date | null;
};

export type GroupParticipantOrderAccess = {
  orderId: string;
  customerPhone: string;
  participantId: string;
  participantDisplayName: string;
  groupOrderSessionId: string;
};

const GROUP_ORDER_PARTICIPANT_ID_COOKIE = "mennyu_go_participant";
const GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY = "mennyu_go_join";

/** Parse participant markers from a Cookie header (route handlers). */
export function readGroupOrderParticipantMarkersFromCookieHeader(
  cookieHeader: string | null | undefined
): GroupOrderParticipantMarkers {
  if (!cookieHeader?.trim()) {
    return { participantId: null, legacyJoinToken: null };
  }
  const parts = cookieHeader.split(";").map((p) => p.trim());
  let participantId: string | null = null;
  let legacyJoinToken: string | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    if (name === GROUP_ORDER_PARTICIPANT_ID_COOKIE) participantId = value || null;
    if (name === GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY) legacyJoinToken = value || null;
  }
  return { participantId, legacyJoinToken };
}

export function readGroupOrderParticipantMarkersFromRequest(
  cookieStore: Pick<ReadonlyRequestCookies, "get"> | null,
  cookieHeader?: string | null
): GroupOrderParticipantMarkers {
  if (cookieStore) {
    return readGroupOrderParticipantMarkers(cookieStore);
  }
  return readGroupOrderParticipantMarkersFromCookieHeader(cookieHeader);
}

/** Latest order linked to a submitted group session. */
export async function findOrderIdForGroupOrderSession(
  groupOrderSessionId: string
): Promise<string | null> {
  const order = await prisma.order.findFirst({
    where: { groupOrderSessionId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return order?.id ?? null;
}

/**
 * Resolve participant row from HttpOnly participant id (or legacy join cookie).
 * Works when session is submitted — unlike resolveActorForGroupCart.
 */
export async function resolveGroupParticipantForSession(
  groupOrderSessionId: string,
  markers: GroupOrderParticipantMarkers
): Promise<ResolvedGroupParticipant | null> {
  const participantId = markers.participantId?.trim();
  if (participantId) {
    const row = await prisma.groupOrderParticipant.findFirst({
      where: { id: participantId, groupOrderSessionId },
      select: {
        id: true,
        role: true,
        displayName: true,
        groupOrderSessionId: true,
        leftAt: true,
      },
    });
    if (row) return row;
  }

  const legacyToken = markers.legacyJoinToken?.trim();
  if (legacyToken) {
    const row = await prisma.groupOrderParticipant.findFirst({
      where: { joinToken: legacyToken, groupOrderSessionId },
      select: {
        id: true,
        role: true,
        displayName: true,
        groupOrderSessionId: true,
        leftAt: true,
      },
    });
    if (row) return row;
  }

  return null;
}

export async function resolveGroupParticipantOrderAccess(args: {
  orderId: string;
  markers: GroupOrderParticipantMarkers;
}): Promise<GroupParticipantOrderAccess | null> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      customerPhone: true,
      groupOrderSessionId: true,
    },
  });
  if (!order?.groupOrderSessionId) return null;

  const session = await prisma.groupOrderSession.findUnique({
    where: { id: order.groupOrderSessionId },
    select: { id: true, status: true },
  });
  if (!session || session.status !== "submitted") return null;

  const participant = await resolveGroupParticipantForSession(session.id, args.markers);
  if (!participant || participant.role !== "participant") return null;

  return {
    orderId: order.id,
    customerPhone: order.customerPhone.trim(),
    participantId: participant.id,
    participantDisplayName: participant.displayName,
    groupOrderSessionId: session.id,
  };
}

export async function getHostParticipantIdForGroupSession(
  groupOrderSessionId: string
): Promise<string | null> {
  const host = await prisma.groupOrderParticipant.findFirst({
    where: { groupOrderSessionId, role: "host" },
    select: { id: true },
  });
  return host?.id ?? null;
}
