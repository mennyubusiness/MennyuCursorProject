"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuickCart } from "@/components/cart/QuickCartContext";
import { AwaitCartNavigationLink } from "@/components/cart/AwaitCartNavigationLink";
import { QuickCartLineControls } from "@/components/cart/QuickCartLineControls";
import { QuickCartHeader } from "@/components/cart/QuickCartHeader";
import { QuickCartGroupSection } from "@/components/cart/QuickCartGroupSection";
import { ButtonLink } from "@/components/ui/button";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { getCurrentPodIdFromClient } from "@/lib/quick-cart-pod";
import {
  quickCartFooterCtaLabel,
  resolveQuickCartPodContext,
} from "@/lib/quick-cart-display";

export function QuickCartDrawer() {
  const { enabled, isOpen, closeCart, cart, loading, applyCartSnapshot, refreshCart, hasServerSession } =
    useQuickCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!enabled || !mounted || !isOpen) return null;

  const clientPodId = getCurrentPodIdFromClient();
  const pod = resolveQuickCartPodContext(cart, clientPodId);
  const hasPod = Boolean(pod.podId);
  const groupOrder = cart?.groupOrder;
  const canCheckout = groupOrder?.canCheckout ?? true;
  const isParticipant = groupOrder?.role === "participant";
  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const hasItems = Boolean(cart && cart.items.length > 0);
  const footerCta = quickCartFooterCtaLabel({
    hasItems,
    groupRole: groupOrder?.role,
    canCheckout,
  });

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-oo-charcoal/50 backdrop-blur-[1px]"
        aria-label="Close cart"
        onClick={closeCart}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-oo-light-stone bg-oo-warm-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-cart-title"
      >
        <QuickCartHeader
          pod={pod}
          groupOrder={groupOrder}
          onClose={closeCart}
          onNavigate={closeCart}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <QuickCartGroupSection
            cart={cart}
            podId={pod.podId}
            hasServerSession={hasServerSession}
            onNavigate={closeCart}
          />

          {loading && !cart ? (
            <p className="text-sm text-oo-stone-gray">Loading cart…</p>
          ) : !hasPod ? (
            <div className="oo-empty-state px-6 py-10">
              <p className="font-semibold text-oo-charcoal">Your cart is empty</p>
              <p className="mt-2 text-sm text-oo-stone-gray">
                Start with a food pod or vendor to begin ordering.
              </p>
              <ButtonLink href="/explore" variant="secondary" size="sm" className="mt-6">
                Explore pods
              </ButtonLink>
            </div>
          ) : cart && cart.items.length === 0 ? (
            <div className="oo-empty-state px-6 py-10">
              <p className="font-semibold text-oo-charcoal">Your cart is empty</p>
              <p className="mt-2 text-sm text-oo-stone-gray">Add items from a vendor in this pod.</p>
            </div>
          ) : cart ? (
            <ul className="space-y-5">
              {cart.groups.map((group) => (
                <li key={group.vendorId}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
                    {group.vendorName}
                  </p>
                  <ul className="mt-2 space-y-3">
                    {group.items.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-start justify-between gap-3 border-b border-oo-light-stone pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-oo-charcoal">
                            {line.menuItem?.name ?? "Item"}
                          </p>
                          {(line.selections?.length ?? 0) > 0 && (
                            <p className="mt-0.5 text-xs text-oo-stone-gray">{shortCartLineLabel(line)}</p>
                          )}
                          <p className="mt-1 text-sm font-medium tabular-nums text-oo-charcoal">
                            ${((line.priceCents * line.quantity) / 100).toFixed(2)}
                          </p>
                        </div>
                        <QuickCartLineControls
                          cartId={cart.id}
                          cartItemId={line.id}
                          quantity={line.quantity}
                          onUpdated={async (next) => {
                            if (next) applyCartSnapshot(next);
                            else await refreshCart();
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <footer className="border-t border-oo-light-stone bg-oo-warm-white px-4 py-4 sm:px-5">
          {cart && hasItems && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-oo-stone-gray">{isParticipant ? "Your subtotal" : "Subtotal"}</span>
                <span className="text-base font-bold tabular-nums text-oo-charcoal">
                  ${(cart.subtotalCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-oo-stone-gray">
                {itemCount} item{itemCount === 1 ? "" : "s"}
                {isParticipant
                  ? " · host checks out for the group"
                  : canCheckout
                    ? " · tax & fees at checkout"
                    : ""}
              </p>
            </>
          )}
          <AwaitCartNavigationLink
            cartId={cart?.id}
            href="/cart"
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
            onClick={closeCart}
          >
            {footerCta}
          </AwaitCartNavigationLink>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
