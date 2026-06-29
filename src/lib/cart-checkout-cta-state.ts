import { formatMobileBottomActionSummary } from "@/lib/mobile-customer-ui";
import { groupParticipantWaitingCopy } from "@/lib/group-order-checkout-permission";

export type CartCheckoutCtaInput = {
  viewerCanCheckout: boolean;
  canCheckout: boolean;
  isRevalidating: boolean;
  isSyncingCart: boolean;
  groupSubmitted: boolean;
  showParticipantTotalsOnly: boolean;
  sessionLockedCheckout: boolean;
  itemCount: number;
  subtotalCents: number;
  participantSubtotalCents?: number;
};

export type CartCheckoutCtaState = {
  checkoutEnabled: boolean;
  blockedLabel: string;
  primaryLabel: string;
  summaryTitle: string;
  summarySubtitle: string | null;
  showTrackOrder: boolean;
  showParticipantMessage: boolean;
  participantMessage: string;
};

export function resolveCartCheckoutCtaState(input: CartCheckoutCtaInput): CartCheckoutCtaState {
  const checkoutEnabled =
    input.viewerCanCheckout &&
    input.canCheckout &&
    !input.isRevalidating &&
    !input.isSyncingCart &&
    !input.groupSubmitted;

  const blockedLabel = input.isSyncingCart
    ? "Syncing your cart…"
    : !input.viewerCanCheckout && !input.showParticipantTotalsOnly
      ? "Only the host can check out for this group order"
      : !input.canCheckout && input.isRevalidating
        ? "Checking cart…"
        : "Fix items above to continue";

  const subtotalCents =
    input.showParticipantTotalsOnly && input.participantSubtotalCents != null
      ? input.participantSubtotalCents
      : input.subtotalCents;

  const summaryTitle = input.showParticipantTotalsOnly
    ? `Your food · $${(subtotalCents / 100).toFixed(2)}`
    : formatMobileBottomActionSummary(input.itemCount, subtotalCents);

  return {
    checkoutEnabled,
    blockedLabel,
    primaryLabel: checkoutEnabled ? "Proceed to checkout" : blockedLabel,
    summaryTitle,
    summarySubtitle: checkoutEnabled
      ? "Tax and service fee at checkout"
      : blockedLabel,
    showTrackOrder: input.groupSubmitted,
    showParticipantMessage: input.showParticipantTotalsOnly,
    participantMessage: groupParticipantWaitingCopy(input.sessionLockedCheckout),
  };
}
