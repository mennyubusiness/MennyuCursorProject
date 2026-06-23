"use client";

import Link from "next/link";
import { AwaitCartNavigationLink } from "@/components/cart/AwaitCartNavigationLink";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { resolveCartCheckoutCtaState } from "@/lib/cart-checkout-cta-state";
import type { Cart } from "@/domain/types";

export const CART_CHECKOUT_PRIMARY_LABEL = "Proceed to checkout";

export type CartPageCheckoutActionProps = {
  cartId: string;
  podId: string;
  podSlug: string;
  cart: Cart;
  canCheckout: boolean;
  isRevalidating: boolean;
  isSyncingCart: boolean;
  viewerCanCheckout: boolean;
  showParticipantTotalsOnly: boolean;
  sessionLockedCheckout?: boolean;
  myParticipantSubtotalCents?: number;
  totalCentsFallback: number;
  groupSubmitted?: boolean;
  submittedOrderId?: string | null;
};

function useCartCheckoutActionState(props: CartPageCheckoutActionProps) {
  const itemCount = props.cart.items.reduce((n, item) => n + item.quantity, 0);
  const subtotalCents =
    props.cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) ||
    props.cart.subtotalCents ||
    props.totalCentsFallback;

  const cta = resolveCartCheckoutCtaState({
    viewerCanCheckout: props.viewerCanCheckout,
    canCheckout: props.canCheckout,
    isRevalidating: props.isRevalidating,
    isSyncingCart: props.isSyncingCart,
    groupSubmitted: props.groupSubmitted ?? false,
    showParticipantTotalsOnly: props.showParticipantTotalsOnly,
    sessionLockedCheckout: props.sessionLockedCheckout ?? false,
    itemCount: itemCount || (props.totalCentsFallback > 0 ? 1 : 0),
    subtotalCents,
    participantSubtotalCents: props.myParticipantSubtotalCents,
  });

  const checkoutEnabled =
    props.viewerCanCheckout &&
    props.canCheckout &&
    !props.isRevalidating &&
    !props.isSyncingCart &&
    !(props.groupSubmitted ?? false);

  const blockedLabel = props.isSyncingCart
    ? "Syncing your cart…"
    : !props.viewerCanCheckout && !props.showParticipantTotalsOnly
      ? "Only the host can check out for this group order"
      : !props.canCheckout && props.isRevalidating
        ? "Checking cart…"
        : cta.blockedLabel;

  return { checkoutEnabled, blockedLabel };
}

/** In-page checkout CTA inside the order summary — shared by mobile and desktop. */
export function CartPageSummaryCheckoutActions(props: CartPageCheckoutActionProps) {
  const {
    cartId,
    podId,
    podSlug,
    groupSubmitted,
    submittedOrderId,
    showParticipantTotalsOnly,
    sessionLockedCheckout = false,
  } = props;
  const { checkoutEnabled, blockedLabel } = useCartCheckoutActionState(props);

  if (groupSubmitted && submittedOrderId) {
    return (
      <div className="mt-6 border-t border-oo-light-stone pt-6">
        <Link
          href={`/order/${submittedOrderId}`}
          className={cn(
            buttonClassName({ variant: "primary", size: "touch" }),
            "inline-flex w-full items-center justify-center"
          )}
        >
          Track order
        </Link>
      </div>
    );
  }

  if (showParticipantTotalsOnly) {
    return (
      <div className="mt-6 border-t border-oo-light-stone pt-6">
        <p className="text-sm text-oo-stone-gray">
          {sessionLockedCheckout
            ? "The host is checking out. New changes are paused."
            : "The host will check out when everyone is ready."}
        </p>
        <Link
          href={buildPodCustomerPath(podSlug)}
          className={cn(
            buttonClassName({ variant: "outline", size: "touch" }),
            "mt-3 inline-flex w-full items-center justify-center"
          )}
        >
          Back to pod
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-oo-light-stone pt-6">
      {checkoutEnabled ? (
        <AwaitCartNavigationLink
          cartId={cartId}
          href={`/checkout?cartId=${cartId}`}
          className={cn(
            buttonClassName({ variant: "primary", size: "touch" }),
            "inline-flex w-full items-center justify-center"
          )}
        >
          {CART_CHECKOUT_PRIMARY_LABEL}
        </AwaitCartNavigationLink>
      ) : (
        <>
          <button
            type="button"
            disabled
            aria-disabled
            className={cn(
              buttonClassName({ variant: "primary", size: "touch" }),
              "inline-flex w-full cursor-not-allowed items-center justify-center opacity-60"
            )}
          >
            {CART_CHECKOUT_PRIMARY_LABEL}
          </button>
          {blockedLabel ? (
            <p className="mt-2 text-sm text-oo-stone-gray">{blockedLabel}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function cartPageLiveItemCount(cart: Cart): number {
  return cart.items.reduce((n, item) => n + item.quantity, 0);
}
