"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActiveCartRecovery } from "@/domain/types";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { recoveryItemCountLabel } from "@/lib/quick-cart-active-recovery";
import { cn } from "@/lib/cn";

type Props = {
  recovery: ActiveCartRecovery;
  browsingPodName: string | null;
  onNavigate?: () => void;
  onClearAndSwitch?: () => Promise<void>;
  onClearCart?: () => Promise<void>;
};

function actionClass(variant: "primary" | "secondary" = "secondary") {
  return cn(
    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
    variant === "primary"
      ? "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15"
      : "border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
  );
}

export function QuickCartActiveRecoverySection({
  recovery,
  browsingPodName,
  onNavigate,
  onClearAndSwitch,
  onClearCart,
}: Props) {
  const [clearing, setClearing] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const podHref = recovery.podSlug
    ? buildPodCustomerPath(recovery.podSlug)
    : `/pod/${recovery.podId}`;
  const inviteHref = recovery.groupOrderSessionId
    ? `/group-order/join?session=${encodeURIComponent(recovery.groupOrderSessionId)}`
    : "/group-order/join";

  async function handleClearAndSwitch() {
    if (!onClearAndSwitch || recovery.kind !== "solo_cart") return;
    setClearError(null);
    setClearing(true);
    try {
      await onClearAndSwitch();
    } catch (e) {
      setClearError(e instanceof Error ? e.message : "Could not clear cart.");
    } finally {
      setClearing(false);
    }
  }

  async function handleClearCart() {
    if (!onClearCart || recovery.kind !== "solo_cart") return;
    setClearError(null);
    setClearingCart(true);
    try {
      await onClearCart();
    } catch (e) {
      setClearError(e instanceof Error ? e.message : "Could not clear cart.");
    } finally {
      setClearingCart(false);
    }
  }

  if (recovery.isConflictingWithBrowsePod) {
    return (
      <section className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
        <p className="font-semibold">Your cart is for {recovery.podName}</p>
        <p className="mt-1 text-xs">
          Clear it to start an order from {browsingPodName ?? "this pod"}.
        </p>
        {clearError && <p className="mt-2 text-xs text-red-800">{clearError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={podHref} onClick={onNavigate} className={actionClass("primary")}>
            Resume {recovery.podName}
          </Link>
          {recovery.kind === "solo_cart" && onClearAndSwitch ? (
            <button
              type="button"
              disabled={clearing}
              onClick={() => void handleClearAndSwitch()}
              className={actionClass()}
            >
              {clearing ? "Clearing…" : "Clear and switch"}
            </button>
          ) : (
            <p className="w-full text-[11px] text-amber-900/80">
              Leave or finish your group order before ordering from another pod.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
        Continue your order
      </p>
      {recovery.kind === "solo_cart" && (
        <>
          <p className="mt-1 font-semibold text-oo-charcoal">{recovery.podName}</p>
          <p className="mt-0.5 text-xs text-oo-stone-gray">
            {recovery.itemCount != null ? recoveryItemCountLabel(recovery.itemCount) : "Items in cart"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={podHref}
              onClick={onNavigate}
              className={actionClass("primary")}
            >
              Resume order
            </Link>
            {onClearCart ? (
              <button
                type="button"
                disabled={clearingCart}
                onClick={() => void handleClearCart()}
                className={actionClass()}
              >
                {clearingCart ? "Clearing…" : "Clear cart"}
              </button>
            ) : null}
          </div>
        </>
      )}
      {recovery.kind === "group_host" && (
        <>
          <p className="mt-1 font-semibold text-oo-charcoal">
            Hosting group order · {recovery.podName}
          </p>
          {recovery.participantCount != null && recovery.participantCount > 0 && (
            <p className="mt-0.5 text-xs text-oo-stone-gray">
              {recovery.participantCount} {recovery.participantCount === 1 ? "person" : "people"}
            </p>
          )}
          {recovery.groupCode && (
            <p className="mt-1 font-mono text-xs text-oo-stone-gray">
              Code: <span className="font-semibold text-oo-charcoal">{recovery.groupCode}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/cart" onClick={onNavigate} className={actionClass("primary")}>
              Review group cart
            </Link>
            <Link href={inviteHref} onClick={onNavigate} className={actionClass()}>
              Invite others
            </Link>
          </div>
        </>
      )}
      {recovery.kind === "group_participant" && (
        <>
          <p className="mt-1 font-semibold text-oo-charcoal">Group order · {recovery.podName}</p>
          <p className="mt-1 text-xs text-oo-stone-gray">The host will place the order.</p>
          <Link href="/cart" onClick={onNavigate} className={cn(actionClass("primary"), "mt-3 inline-block")}>
            View my items
          </Link>
        </>
      )}
    </section>
  );
}
