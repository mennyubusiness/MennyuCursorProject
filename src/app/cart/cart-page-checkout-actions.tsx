"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { AwaitCartNavigationLink } from "@/components/cart/AwaitCartNavigationLink";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { flushCartMutations } from "@/lib/cart-mutation-queue";
import { resolveCartCheckoutCtaState } from "@/lib/cart-checkout-cta-state";
import type { Cart } from "@/domain/types";

export const CART_CHECKOUT_PRIMARY_LABEL = "Proceed to checkout";

export type CartPageCheckoutActionProps = {
  cartId: string;
  podId: string;
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

  return { itemCount, subtotalCents, cta, checkoutEnabled, blockedLabel };
}

/** Primary checkout CTA in the order summary — desktop only; mobile uses the sticky bar. */
export function CartPageSummaryCheckoutActions(props: CartPageCheckoutActionProps) {
  const { cartId, podId, groupSubmitted, submittedOrderId, showParticipantTotalsOnly } = props;
  const { checkoutEnabled, blockedLabel } = useCartCheckoutActionState(props);

  if (groupSubmitted && submittedOrderId) {
    return (
      <div className="mt-6 border-t border-stone-100 pt-6">
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
      <div className="mt-6 border-t border-stone-100 pt-6">
        <p className="text-sm text-stone-600">
          The host will check out when everyone is ready.
        </p>
        <Link
          href={`/pod/${podId}`}
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
            "hidden w-full items-center justify-center lg:inline-flex"
          )}
        >
          {CART_CHECKOUT_PRIMARY_LABEL}
        </AwaitCartNavigationLink>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled
          className={cn(
            buttonClassName({ variant: "primary", size: "touch" }),
            "hidden w-full cursor-not-allowed items-center justify-center opacity-60 lg:inline-flex"
          )}
        >
          {blockedLabel}
        </button>
      )}
      {!checkoutEnabled && blockedLabel ? (
        <p className="mt-2 hidden text-sm text-oo-stone-gray lg:block">{blockedLabel}</p>
      ) : null}
    </div>
  );
}

function CartPageMobileCheckoutBarContent(props: CartPageCheckoutActionProps) {
  const { cartId, podId, groupSubmitted, submittedOrderId, showParticipantTotalsOnly } = props;
  const router = useRouter();
  const { itemCount, cta } = useCartCheckoutActionState(props);

  if (groupSubmitted && submittedOrderId) {
    return (
      <MobileBottomActionBar
        summaryTitle={cta.summaryTitle}
        summarySubtitle="Group order placed"
        primaryLabel="Track order"
        primaryHref={`/order/${submittedOrderId}`}
        aria-label="Track group order"
      />
    );
  }

  if (showParticipantTotalsOnly) {
    return (
      <MobileBottomActionBar
        summaryTitle={cta.summaryTitle}
        summarySubtitle={cta.participantMessage}
        primaryLabel="Back to pod"
        primaryHref={`/pod/${podId}`}
        aria-label="Back to pod"
      />
    );
  }

  if (cta.checkoutEnabled) {
    return (
      <MobileBottomActionBar
        summaryTitle={cta.summaryTitle}
        summarySubtitle={cta.summarySubtitle ?? undefined}
        primaryLabel={CART_CHECKOUT_PRIMARY_LABEL}
        onPrimaryClick={() => {
          void flushCartMutations(cartId).then(() => {
            router.push(`/checkout?cartId=${cartId}`);
          });
        }}
        aria-label={`${CART_CHECKOUT_PRIMARY_LABEL}, ${itemCount} items`}
      />
    );
  }

  return (
    <MobileBottomActionBar
      summaryTitle={cta.summaryTitle}
      summarySubtitle={cta.summarySubtitle ?? undefined}
      primaryLabel={CART_CHECKOUT_PRIMARY_LABEL}
      primaryDisabled
      aria-label={cta.blockedLabel}
    />
  );
}

/** Fixed bottom checkout bar — mobile/tablet only (`lg:hidden` on the shared bar shell). */
export function CartPageMobileCheckoutBar(props: CartPageCheckoutActionProps) {
  return <CartPageMobileCheckoutBarContent {...props} />;
}

export function CartPageDesktopCheckoutActions(props: CartPageCheckoutActionProps) {
  const { cartId, podId, groupSubmitted, submittedOrderId, showParticipantTotalsOnly, sessionLockedCheckout = false } =
    props;
  const { checkoutEnabled, blockedLabel } = useCartCheckoutActionState(props);

  return (
    <div className="hidden w-full flex-col gap-1.5 sm:flex sm:w-auto sm:items-end">
      {checkoutEnabled && (
        <p className="text-center text-xs leading-snug text-stone-500 sm:text-right">
          Secure checkout with Stripe · Each vendor is notified after you pay
        </p>
      )}
      {groupSubmitted && submittedOrderId ? (
        <Link
          href={`/order/${submittedOrderId}`}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-900 px-8 py-3.5 text-center text-base font-bold text-white shadow-md transition hover:bg-emerald-800 sm:min-w-[14rem] sm:w-auto"
        >
          Track order
        </Link>
      ) : showParticipantTotalsOnly ? (
        <div className="w-full text-center sm:text-right">
          <p className="text-xs text-stone-500">
            {sessionLockedCheckout
              ? "The host is checking out. New changes are paused."
              : "The host will check out when everyone is ready."}
          </p>
          <Link
            href={`/pod/${podId}`}
            className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-stone-300 bg-white px-8 py-3.5 text-center text-base font-semibold text-stone-900 transition hover:bg-stone-50 sm:min-w-[14rem] sm:w-auto"
          >
            Back to pod
          </Link>
        </div>
      ) : checkoutEnabled ? (
        <AwaitCartNavigationLink
          cartId={cartId}
          href={`/checkout?cartId=${cartId}`}
          className={cn(
            buttonClassName({ variant: "primary", size: "touch" }),
            "hidden min-h-[3rem] w-full items-center justify-center lg:inline-flex lg:min-w-[14rem] lg:w-auto"
          )}
        >
          {CART_CHECKOUT_PRIMARY_LABEL}
        </AwaitCartNavigationLink>
      ) : (
        <span
          className="hidden min-h-[3rem] w-full items-center justify-center rounded-xl bg-oo-cream px-8 py-3.5 text-center text-base font-semibold text-oo-stone-gray lg:inline-flex lg:w-auto"
          aria-disabled
        >
          {blockedLabel}
        </span>
      )}
    </div>
  );
}

export function cartPageLiveItemCount(cart: Cart): number {
  return cart.items.reduce((n, item) => n + item.quantity, 0);
}
