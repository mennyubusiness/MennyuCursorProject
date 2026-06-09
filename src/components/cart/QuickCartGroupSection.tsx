"use client";

import Link from "next/link";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { buildGroupOrderJoinPath } from "@/lib/group-order-invite-url";
import type { Cart } from "@/domain/types";
import type { CartPodContext } from "@/lib/cart-pod-context";
import { ButtonLink } from "@/components/ui/button";

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
  const group = cart?.groupOrder;
  const role = group?.role ?? "solo";
  const browsePodId = podContext.browsingPodId;
  const browsePodName = podContext.browsingPodName;

  if (role === "host" && group?.joinCode) {
    const inviteHref = buildGroupOrderJoinPath(group.joinCode);

    return (
      <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Group order active</p>
        <p className="mt-1 font-mono text-xs text-oo-stone-gray">
          Code: <span className="font-semibold text-oo-charcoal">{group.joinCode}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={inviteHref}
            onClick={onNavigate}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Invite others
          </Link>
          <Link
            href="/cart"
            onClick={onNavigate}
            className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/15"
          >
            Go to group cart
          </Link>
        </div>
      </section>
    );
  }

  if (role === "participant") {
    return (
      <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">You&apos;re in a group order</p>
        <p className="mt-1 text-xs text-oo-stone-gray">The host will place the order.</p>
        <Link
          href="/cart"
          onClick={onNavigate}
          className="mt-3 inline-block text-xs font-semibold text-brand hover:underline"
        >
          View my items
        </Link>
      </section>
    );
  }

  if (role === "unknown") {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Group order</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Join with the host&apos;s code to add your items to this cart.
        </p>
        <ButtonLink
          href="/group-order/join"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={onNavigate}
        >
          Join with code
        </ButtonLink>
      </section>
    );
  }

  if (podContext.cartScope === "neutral" && !suppressNeutralGroupPromo) {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Group order</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Have a group code? Join a shared order.
        </p>
        <ButtonLink
          href="/group-order/join"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={onNavigate}
        >
          Join with code
        </ButtonLink>
      </section>
    );
  }

  if (podContext.cartScope === "browsing_pod" && browsePodId) {
    return (
      <section className="mb-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Order with a group</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          {browsePodName
            ? `Start or join a group order for ${browsePodName}.`
            : "Start or join a group order here."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {podContext.canStartOrderHere ? (
            <Link
              href={startGroupOrderHref(browsePodId, hasServerSession)}
              onClick={onNavigate}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Start group order
            </Link>
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
