"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { AwaitCartNavigationLink } from "@/components/cart/AwaitCartNavigationLink";
import { flushCartMutations } from "@/lib/cart-mutation-queue";
import { resolveCartCheckoutCtaState } from "@/lib/cart-checkout-cta-state";
import type { Cart } from "@/domain/types";

type CartPageCheckoutMutationProps = {
  cartId: string;
  podId: string;
  cart: Cart;
  canCheckout: boolean;
  isRevalidating: boolean;
  isSyncingCart: boolean;
};

type CartPageMobileCheckoutBarProps = CartPageCheckoutMutationProps & {
  viewerCanCheckout: boolean;
  showParticipantTotalsOnly: boolean;
  sessionLockedCheckout?: boolean;
  myParticipantSubtotalCents?: number;
  totalCentsFallback: number;
  groupSubmitted?: boolean;
  submittedOrderId?: string | null;
};

export function CartPageMobileCheckoutBar({
  cartId,
  podId,
  cart,
  canCheckout,
  isRevalidating,
  isSyncingCart,
  viewerCanCheckout,
  showParticipantTotalsOnly,
  sessionLockedCheckout = false,
  myParticipantSubtotalCents,
  totalCentsFallback,
  groupSubmitted = false,
  submittedOrderId = null,
}: CartPageMobileCheckoutBarProps) {
  const router = useRouter();

  const itemCount = cart.items.reduce((n, item) => n + item.quantity, 0);
  const subtotalCents =
    cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) ||
    cart.subtotalCents ||
    totalCentsFallback;

  const cta = resolveCartCheckoutCtaState({
    viewerCanCheckout,
    canCheckout,
    isRevalidating,
    isSyncingCart,
    groupSubmitted,
    showParticipantTotalsOnly,
    sessionLockedCheckout,
    itemCount,
    subtotalCents,
    participantSubtotalCents: myParticipantSubtotalCents,
  });

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

  if (showParticipantTotalsOnly || !viewerCanCheckout) {
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
        primaryLabel="Checkout"
        onPrimaryClick={() => {
          void flushCartMutations(cartId).then(() => {
            router.push(`/checkout?cartId=${cartId}`);
          });
        }}
        aria-label={`Checkout, ${itemCount} items`}
      />
    );
  }

  return (
    <MobileBottomActionBar
      summaryTitle={cta.summaryTitle}
      summarySubtitle={cta.summarySubtitle ?? undefined}
      primaryLabel="Checkout"
      primaryDisabled
      aria-label={cta.blockedLabel}
    />
  );
}

type CartPageDesktopCheckoutActionsProps = CartPageMobileCheckoutBarProps;

export function CartPageDesktopCheckoutActions({
  cartId,
  podId,
  canCheckout,
  isRevalidating,
  isSyncingCart,
  viewerCanCheckout,
  showParticipantTotalsOnly,
  sessionLockedCheckout = false,
  groupSubmitted = false,
  submittedOrderId = null,
}: CartPageDesktopCheckoutActionsProps) {

  const checkoutEnabled =
    viewerCanCheckout && canCheckout && !isRevalidating && !isSyncingCart && !groupSubmitted;
  const blockedLabel = isSyncingCart
    ? "Syncing your cart…"
    : !canCheckout && isRevalidating
      ? "Checking cart…"
      : "Fix items above to continue";

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
      ) : showParticipantTotalsOnly || !viewerCanCheckout ? (
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
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-900 px-8 py-3.5 text-center text-base font-bold text-white shadow-md transition duration-200 hover:bg-stone-800 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.98] sm:min-w-[14rem] sm:w-auto"
        >
          Continue to checkout
        </AwaitCartNavigationLink>
      ) : (
        <span
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-200 px-8 py-3.5 text-center text-base font-semibold text-stone-500 sm:w-auto"
          aria-disabled
        >
          {blockedLabel}
        </span>
      )}
    </div>
  );
}
