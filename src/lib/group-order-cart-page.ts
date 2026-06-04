/**
 * Group-order reads and cart-page bootstrap mutations for Server Components.
 * No revalidatePath or cookie writes — use group-order.actions for form/client mutations.
 */
import "server-only";

import { auth } from "@/auth";
import {
  findSessionByCartId,
  startGroupOrderSession,
  unlockGroupOrderSessionFromCheckout,
} from "@/services/group-order.service";

export type GroupOrderStateForCartPage =
  | { active: false }
  | {
      active: true;
      sessionId: string;
      joinCode: string;
      status: string;
      podId: string;
      participants: Array<{ id: string; displayName: string; isHost: boolean }>;
      isHost: boolean;
    };

export async function getGroupOrderStateForCartPage(cartId: string): Promise<GroupOrderStateForCartPage> {
  const authSession = await auth();
  const hostId = authSession?.user?.id ?? null;
  const s = await findSessionByCartId(cartId);
  if (!s) return { active: false };
  return {
    active: true,
    sessionId: s.id,
    joinCode: s.joinCode,
    status: s.status,
    podId: s.podId,
    participants: s.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isHost: p.role === "host",
    })),
    isHost: Boolean(hostId && s.hostUserId === hostId),
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
