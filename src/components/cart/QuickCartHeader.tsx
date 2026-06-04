"use client";

import Link from "next/link";
import {
  quickCartPodLinkLabel,
  quickCartSubtitle,
  type QuickCartPodContext,
} from "@/lib/quick-cart-display";
import type { CartGroupOrderDisplay } from "@/domain/types";

type Props = {
  pod: QuickCartPodContext;
  groupOrder?: CartGroupOrderDisplay;
  onClose: () => void;
  onNavigate?: () => void;
};

export function QuickCartHeader({ pod, groupOrder, onClose, onNavigate }: Props) {
  const subtitle = quickCartSubtitle({
    podName: pod.podName,
    groupRole: groupOrder?.role,
  });

  return (
    <header className="flex items-start justify-between gap-3 border-b border-oo-light-stone px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <h2 id="quick-cart-title" className="text-lg font-bold text-oo-charcoal">
          Your cart
        </h2>
        <p className="mt-0.5 text-xs text-oo-stone-gray">{subtitle}</p>
        {pod.podId ? (
          <Link
            href={`/pod/${pod.podId}`}
            onClick={onNavigate}
            className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
          >
            {quickCartPodLinkLabel(pod.podName)}
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
