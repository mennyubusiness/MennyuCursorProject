"use client";

import Link from "next/link";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import type { Cart } from "@/domain/types";
import type { CartPodContext } from "@/lib/cart-pod-context";
import { isInaccessibleGroupOrderView } from "@/lib/cart-pod-context";
import { ButtonLink } from "@/components/ui/button";
import { QuickCartHostGroupControls } from "@/components/cart/QuickCartHostGroupControls";
import { StartGroupOrderButton } from "@/components/cart/StartGroupOrderButton";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";

type Props = {
  cart: Cart | null;
  podContext: CartPodContext;
  hasServerSession: boolean;
  /** Hide neutral/browse group promo when active recovery already covers group state. */
  suppressNeutralGroupPromo?: boolean;
  onNavigate?: () => void;
};

function startGroupOrderHref(podId: string, hasServerSession: boolean): string {
  const dest = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  return hasServerSession ? dest : buildLoginHrefWithReturn(dest);
}

export function QuickCartGroupSection({
  cart,
  podContext,
  hasServerSession,
  suppressNeutralGroupPromo = false,
  onNavigate,
}: Props) {
  const quickCart = useQuickCartOptional();
  const group = cart?.groupOrder;
  const role = group?.role ?? "solo";
  const browsePodId = podContext.browsingPodId;
  const browsePodName = podContext.browsingPodName;
  const podName = cart?.podName ?? browsePodName ?? podContext.cartPodName;

  const onGroupStarted = () => {
    quickCart?.openCart();
    void quickCart?.refreshCart();
  };

  if (role === "host" && group?.joinCode && cart) {
    return (
      <QuickCartHostGroupControls joinCode={group.joinCode} podName={podName} />
    );
  }

  if (role === "participant") {
    return (
      <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">You&apos;re in a group order</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Add your items before the host checks out.
        </p>
      </section>
    );
  }

  if (isInaccessibleGroupOrderView(cart, podContext.cartScope)) {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Group order</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          This shared cart is not open for your account. Join with a code or start your own group.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {browsePodId && hasServerSession ? (
            <StartGroupOrderButton podId={browsePodId} onStarted={onGroupStarted} />
          ) : browsePodId ? (
            <Link
              href={startGroupOrderHref(browsePodId, false)}
              onClick={onNavigate}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Start group order
            </Link>
          ) : null}
          <ButtonLink href="/group-order/join" variant="secondary" size="sm" onClick={onNavigate}>
            Join with code
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (podContext.cartScope === "neutral" && !suppressNeutralGroupPromo) {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Ordering with friends?</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Start a group order as host or join with a code.
        </p>
        <ButtonLink
          href="/explore"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={onNavigate}
        >
          Choose a pod first
        </ButtonLink>
        <div className="mt-2">
          <ButtonLink href="/group-order/join" variant="secondary" size="sm" onClick={onNavigate}>
            Join with code
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (podContext.cartScope === "browsing_pod" && browsePodId) {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Ordering with friends?</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          {browsePodName
            ? `Start or join a group order for ${browsePodName}.`
            : "Start or join a group order here."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {podContext.canStartOrderHere ? (
            hasServerSession ? (
              <StartGroupOrderButton podId={browsePodId} onStarted={onGroupStarted} />
            ) : (
              <Link
                href={startGroupOrderHref(browsePodId, false)}
                onClick={onNavigate}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                Start group order
              </Link>
            )
          ) : null}
          <Link
            href="/group-order/join"
            onClick={onNavigate}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Join with code
          </Link>
        </div>
      </section>
    );
  }

  return null;
}
