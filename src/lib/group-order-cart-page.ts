/**
 * Group-order reads and cart-page bootstrap mutations for Server Components.
 * No revalidatePath or cookie writes — use group-order.actions for form/client mutations.
 */
import "server-only";

import { auth } from "@/auth";
import {
  findOrderIdForGroupOrderSession,
  resolveGroupParticipantForSession,
} from "@/lib/group-participant-order-access";
import {
  findSessionByCartId,
  resolveActorForGroupCart,
  startGroupOrderSession,
  unlockGroupOrderSessionFromCheckout,
} from "@/services/group-order.service";

export type GroupOrderStateForCartPage =
  | { active: false }
  | {
      active: true;
      view: "host";
      sessionId: string;
      joinCode: string;
      status: string;
      podId: string;
      participants: Array<{ id: string; displayName: string; isHost: boolean }>;
      isHost: true;
      submittedOrderId?: string | null;
    }
  | {
      active: true;
      view: "participant";
      status: string;
      podId: string;
      viewerDisplayName: string;
      isHost: false;
      participantId: string;
      submittedOrderId?: string | null;
    }
  | {
      active: true;
      view: "unknown";
      status: string;
      podId: string;
      isHost: false;
      submittedOrderId?: string | null;
    };

export async function getGroupOrderStateForCartPage(
  cartId: string,
  opts?: {
    participantMarkers?: import("@/lib/group-order-participant-cookie").GroupOrderParticipantMarkers | null;
  }
): Promise<GroupOrderStateForCartPage> {
  const authSession = await auth();
  const hostId = authSession?.user?.id ?? null;
  const s = await findSessionByCartId(cartId);
  if (!s) return { active: false };

  const markers = opts?.participantMarkers ?? { participantId: null, legacyJoinToken: null };
  const submittedOrderId =
    s.status === "submitted" ? await findOrderIdForGroupOrderSession(s.id) : null;

  const isHost = Boolean(hostId && s.hostUserId === hostId);
  if (isHost) {
    return {
      active: true,
      view: "host",
      sessionId: s.id,
      joinCode: s.joinCode,
      status: s.status,
      podId: s.podId,
      participants: s.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isHost: p.role === "host",
      })),
      isHost: true,
      submittedOrderId,
    };
  }

  const participant = await resolveGroupParticipantForSession(s.id, markers);
  if (participant?.role === "participant") {
    return {
      active: true,
      view: "participant",
      status: s.status,
      podId: s.podId,
      viewerDisplayName: participant.displayName,
      isHost: false,
      participantId: participant.id,
      submittedOrderId,
    };
  }

  const actor = await resolveActorForGroupCart(cartId, {
    hostUserId: hostId,
    participantIdFromCookie: markers.participantId,
    joinTokenFromCookie: markers.legacyJoinToken,
  });

  if (actor?.role === "participant") {
    const self = s.participants.find((p) => p.id === actor.participantId);
    return {
      active: true,
      view: "participant",
      status: s.status,
      podId: s.podId,
      viewerDisplayName: self?.displayName ?? "Guest",
      isHost: false,
      participantId: actor.participantId,
      submittedOrderId,
    };
  }

  return {
    active: true,
    view: "unknown",
    status: s.status,
    podId: s.podId,
    isHost: false,
    submittedOrderId,
  };
}

export type StartGroupOrderForCartPageResult =
  | { success: true; sessionId: string; joinCode: string }
  | { success: false; error: string };

export async function startGroupOrderForCartPage(
  cartId: string,
  podId: string,
  hostUserId: string,
  hostDisplayName: string
): Promise<StartGroupOrderForCartPageResult> {
  try {
    const { sessionId, joinCode } = await startGroupOrderSession({
      hostUserId,
      cartId,
      podId,
      hostDisplayName,
    });
    return { success: true, sessionId, joinCode };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "GROUP_ORDER_SESSION_EXISTS") {
      return { success: false, error: "This cart already has a group order." };
    }
    if (msg === "CART_POD_MISMATCH") {
      return { success: false, error: "This cart does not match that kiosk." };
    }
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return {
        success: false,
        error: "Could not start group order. Refresh the page and try again.",
      };
    }
    return { success: false, error: msg };
  }
}

/** Unlock group checkout lock during cart page navigation (no cache revalidation). */
export async function unlockGroupCheckoutForCartPage(cartId: string, hostUserId: string): Promise<void> {
  await unlockGroupOrderSessionFromCheckout(cartId, hostUserId);
}
