/**
 * Authoritative active cart resolution for /cart SSR and participant redirect guards.
 * Historical completed group orders must never override a current session cart.
 */
import "server-only";

import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { loadActiveGroupCartForCartPage } from "@/lib/group-order-cart-page";
import {
  resolveParticipantSubmittedOrderRedirect,
  type SubmittedParticipantCartResolution,
  resolveSubmittedGroupOrderForParticipantCart,
} from "@/lib/group-participant-submitted-cart";
import {
  CART_DISPLAY_SESSION_CART_INCLUDE,
  loadActiveDisplayCartForSession,
} from "@/services/cart.service";

export type ActiveCartPageRow = NonNullable<
  Awaited<ReturnType<typeof resolveActiveCartForCartPage>>
>;

/** Shared resolver for Quick Cart parity: active group binding, then session/account cart. */
export async function resolveActiveCartForCartPage(args: {
  sessionId: string;
  preferredPodId: string | null;
  participantMarkers: GroupOrderParticipantMarkers;
  hostUserId: string | null;
}) {
  return (
    (await loadActiveGroupCartForCartPage({
      hostUserId: args.hostUserId,
      participantMarkers: args.participantMarkers,
      preferredPodId: args.preferredPodId,
    })) ??
    (await loadActiveDisplayCartForSession(
      args.sessionId,
      args.preferredPodId,
      args.participantMarkers,
      args.hostUserId
    ))
  );
}

export type ParticipantCartRedirectDecision =
  | { redirect: false }
  | { redirect: true; orderId: string; resolution: Extract<SubmittedParticipantCartResolution, { kind: "submitted" }> };

/**
 * Redirect participants to order status only during an active post-payment handoff.
 * Never redirect for terminal/completed historical orders or when a current cart should show.
 */
export async function resolveParticipantCartPageRedirect(args: {
  participantMarkers: GroupOrderParticipantMarkers;
  activeCart: { id: string } | null | undefined;
}): Promise<ParticipantCartRedirectDecision> {
  const orderId = await resolveParticipantSubmittedOrderRedirect(args);
  if (!orderId) {
    return { redirect: false };
  }

  const resolution = await resolveSubmittedGroupOrderForParticipantCart(args.participantMarkers);
  if (resolution.kind !== "submitted") {
    return { redirect: false };
  }

  return { redirect: true, orderId, resolution };
}

export { CART_DISPLAY_SESSION_CART_INCLUDE };
