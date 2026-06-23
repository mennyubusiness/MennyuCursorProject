"use client";

import Link from "next/link";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { quickCartPodLinkLabel, quickCartSubtitle } from "@/lib/quick-cart-display";
import type { CartPodContext } from "@/lib/cart-pod-context";

type Props = {
  podContext: CartPodContext;
  onClose: () => void;
  onNavigate?: () => void;
};

export function QuickCartHeader({ podContext, onClose, onNavigate }: Props) {
  const subtitle = quickCartSubtitle(podContext);
  const linkPodSlug = podContext.cartPodSlug ?? podContext.browsingPodSlug;

  return (
    <header className="flex items-start justify-between gap-3 border-b border-oo-light-stone px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <h2 id="quick-cart-title" className="text-lg font-bold text-oo-charcoal">
          Your cart
        </h2>
        <p className="mt-0.5 text-xs text-oo-stone-gray">{subtitle}</p>
        {linkPodSlug ? (
          <Link
            href={buildPodCustomerPath(linkPodSlug)}
            onClick={onNavigate}
            className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
          >
            {quickCartPodLinkLabel(podContext)}
          </Link>
        ) : (
          <Link
            href="/explore"
            onClick={onNavigate}
            className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
          >
            Explore pods
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-2 text-oo-stone-gray transition hover:bg-oo-cream hover:text-oo-charcoal"
        aria-label="Close"
      >
        <span className="text-xl leading-none" aria-hidden>
          ×
        </span>
      </button>
    </header>
  );
}
