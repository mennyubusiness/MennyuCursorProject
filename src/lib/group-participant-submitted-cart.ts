/**
 * Resolve submitted group-order state for participants (cart page + submission polling).
 */
import "server-only";

import { prisma } from "@/lib/db";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import {
  findOrderIdForGroupOrderSession,
  resolveGroupParticipantForSession,
} from "@/lib/group-participant-order-access";
import { resolveActiveGroupParticipantBinding } from "@/lib/group-order-participant-resolve";
import { CART_DISPLAY_SESSION_CART_INCLUDE } from "@/services/cart.service";

export type SubmittedParticipantCartResolution =
  | { kind: "none" }
  | {
      kind: "submitted";
      cartId: string;
      podId: string;
      groupOrderSessionId: string;
      participantId: string;
      orderId: string | null;
    };

async function findParticipantRowForSubmittedLookup(markers: GroupOrderParticipantMarkers) {
  const participantId = markers.participantId?.trim();
  if (participantId) {
    return prisma.groupOrderParticipant.findFirst({
      where: { id: participantId, role: "participant" },
      select: {
        id: true,
        groupOrderSessionId: true,
        groupOrderSession: {
          select: { id: true, status: true, cartId: true, podId: true },
        },
      },
    });
  }

  const legacyToken = markers.legacyJoinToken?.trim();
  if (!legacyToken) return null;

  return prisma.groupOrderParticipant.findFirst({
    where: { joinToken: legacyToken, role: "participant" },
    select: {
      id: true,
      groupOrderSessionId: true,
      groupOrderSession: {
        select: { id: true, status: true, cartId: true, podId: true },
      },
    },
  });
}

/** Participant cookie + submitted session → order id when available. */
export async function resolveSubmittedGroupOrderForParticipantCart(
  markers: GroupOrderParticipantMarkers
): Promise<SubmittedParticipantCartResolution> {
  const row = await findParticipantRowForSubmittedLookup(markers);
  if (!row || row.groupOrderSession.status !== "submitted") {
    return { kind: "none" };
  }

  const orderId = await findOrderIdForGroupOrderSession(row.groupOrderSession.id);
  return {
    kind: "submitted",
    cartId: row.groupOrderSession.cartId,
    podId: row.groupOrderSession.podId,
    groupOrderSessionId: row.groupOrderSession.id,
    participantId: row.id,
    orderId,
  };
}

export async function loadParticipantGroupCartRowForCartPage(
  markers: GroupOrderParticipantMarkers
) {
  const binding = await resolveActiveGroupParticipantBinding(markers);
  if (binding) {
    return prisma.cart.findUnique({
      where: { id: binding.cartId },
      include: CART_DISPLAY_SESSION_CART_INCLUDE,
    });
  }

  const resolved = await resolveSubmittedGroupOrderForParticipantCart(markers);
  if (resolved.kind !== "submitted") return null;
  return prisma.cart.findUnique({
    where: { id: resolved.cartId },
    include: CART_DISPLAY_SESSION_CART_INCLUDE,
  });
}

export type GroupOrderSubmissionStatusForClient = {
  ok: true;
  sessionStatus: string;
  submittedOrderId: string | null;
};

/** Authorized participant-only submission status for a cart (polling). */
export async function getGroupOrderSubmissionStatusForParticipantCart(args: {
  cartId: string;
  markers: GroupOrderParticipantMarkers;
}): Promise<GroupOrderSubmissionStatusForClient | { ok: false; status: number }> {
  const session = await prisma.groupOrderSession.findUnique({
    where: { cartId: args.cartId },
    select: { id: true, status: true },
  });
  if (!session) {
    return { ok: false, status: 404 };
  }

  const participant = await resolveGroupParticipantForSession(session.id, args.markers);
  if (!participant || participant.role !== "participant") {
    return { ok: false, status: 403 };
  }

  if (session.status !== "submitted") {
    return {
      ok: true,
      sessionStatus: session.status,
      submittedOrderId: null,
    };
  }

  const submittedOrderId = await findOrderIdForGroupOrderSession(session.id);
  return {
    ok: true,
    sessionStatus: "submitted",
    submittedOrderId,
  };
}
