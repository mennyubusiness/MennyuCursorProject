import type { GroupOrderViewerRole } from "@/lib/group-order-viewer-context";

export type GroupPaymentActorRole = GroupOrderViewerRole;

export type CanAccessPaymentStepInput = {
  /** True when the cart has an active (non-terminal) group order session. */
  isGroupOrder: boolean;
  actorRole: GroupPaymentActorRole;
  /** Cart page group state view when available. */
  goStateView?: "host" | "participant" | "unknown";
  groupSessionActive?: boolean;
};

/**
 * Authoritative rule for who may open checkout/payment UI or create a PaymentIntent.
 * Solo carts: normal checkout. Group carts: host only.
 */
export function canAccessPaymentStep(input: CanAccessPaymentStepInput): boolean {
  if (!input.isGroupOrder) return true;
  if (input.actorRole === "participant" || input.actorRole === "unknown") return false;
  if (input.groupSessionActive && input.goStateView && input.goStateView !== "host") {
    return false;
  }
  return input.actorRole === "host";
}

export const GROUP_PARTICIPANT_CHECKOUT_WAITING_MESSAGE =
  "Waiting for the host to finish checkout.";

export const GROUP_PARTICIPANT_ORDER_REDIRECT_MESSAGE =
  "You'll be taken to the order status page once the order is placed.";

export function groupParticipantWaitingCopy(sessionLockedCheckout: boolean): string {
  if (sessionLockedCheckout) {
    return `${GROUP_PARTICIPANT_CHECKOUT_WAITING_MESSAGE} ${GROUP_PARTICIPANT_ORDER_REDIRECT_MESSAGE}`;
  }
  return "The host will check out when everyone is ready.";
}

/** Cart/checkout redirect target when payment access is denied for a group participant. */
export function groupParticipantCheckoutRedirectPath(cartId: string): string {
  return `/cart?error=${encodeURIComponent("group_checkout_host_only")}&cartId=${encodeURIComponent(cartId)}`;
}
