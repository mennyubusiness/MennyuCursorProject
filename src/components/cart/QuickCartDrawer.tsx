"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuickCart } from "@/components/cart/QuickCartContext";
import { QuickCartLineControls } from "@/components/cart/QuickCartLineControls";
import { ButtonLink } from "@/components/ui/button";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { cn } from "@/lib/cn";

export function QuickCartDrawer() {
  const { enabled, isOpen, closeCart, cart, loading, applyCartSnapshot, refreshCart } = useQuickCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!enabled || !mounted || !isOpen) return null;

  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const hasPod = Boolean(cart?.podId);

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
        <header className="flex items-start justify-between gap-3 border-b border-oo-light-stone px-4 py-4 sm:px-5">
          <div>
            <h2 id="quick-cart-title" className="text-lg font-bold text-oo-charcoal">
              Your cart
            </h2>
            <p className="mt-0.5 text-xs text-oo-stone-gray">Multi-vendor · one checkout</p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-lg p-2 text-oo-stone-gray transition hover:bg-oo-cream hover:text-oo-charcoal"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
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
              <p className="mt-2 text-sm text-oo-stone-gray">Start with a food pod or vendor.</p>
              {cart.podId && (
                <ButtonLink
                  href={`/pod/${cart.podId}`}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Browse this pod
                </ButtonLink>
              )}
              <ButtonLink href="/explore" variant="outline" size="sm" className="mt-2">
                Explore pods
              </ButtonLink>
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
          {cart && cart.items.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-oo-stone-gray">Subtotal</span>
                <span className="text-base font-bold tabular-nums text-oo-charcoal">
                  ${(cart.subtotalCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-oo-stone-gray">
                {itemCount} item{itemCount === 1 ? "" : "s"} · tax & fees at checkout
              </p>
            </>
          )}
          <ButtonLink
            href="/cart"
            className="mt-4 w-full"
            size="md"
            variant={cart && cart.items.length > 0 ? "primary" : "outline"}
            onClick={closeCart}
          >
            {cart && cart.items.length > 0 ? "Review cart & checkout" : "Go to cart"}
          </ButtonLink>
          <p className="mt-2 text-center text-[11px] text-oo-stone-gray">
            <Link href="/cart" className="font-medium text-oo-charcoal hover:underline" onClick={closeCart}>
              Open full cart page
            </Link>
          </p>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
