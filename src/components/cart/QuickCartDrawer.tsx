"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuickCart } from "@/components/cart/QuickCartContext";
import { QuickCartLineControls } from "@/components/cart/QuickCartLineControls";
import { ButtonLink } from "@/components/ui/button";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { cn } from "@/lib/cn";

export function QuickCartDrawer() {
  const { enabled, isOpen, closeCart, cart, loading, setCart, refreshCart } = useQuickCart();
  const router = useRouter();
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
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close cart"
        onClick={closeCart}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-cart-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
          <div>
            <h2 id="quick-cart-title" className="text-lg font-bold text-black">
              Your cart
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600">Multi-vendor · one checkout</p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !cart ? (
            <p className="text-sm text-zinc-500">Loading cart…</p>
          ) : !hasPod ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
              <p className="font-semibold text-zinc-900">Your cart is empty</p>
              <p className="mt-2 text-sm text-zinc-600">
                Start with a food pod or vendor to begin ordering.
              </p>
              <ButtonLink href="/explore" variant="secondary" size="sm" className="mt-6">
                Explore pods
              </ButtonLink>
            </div>
          ) : cart && cart.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
              <p className="font-semibold text-zinc-900">Your cart is empty</p>
              <p className="mt-2 text-sm text-zinc-600">Start with a food pod or vendor.</p>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    {group.vendorName}
                  </p>
                  <ul className="mt-2 space-y-3">
                    {group.items.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900">
                            {line.menuItem?.name ?? "Item"}
                          </p>
                          {(line.selections?.length ?? 0) > 0 && (
                            <p className="mt-0.5 text-xs text-zinc-500">{shortCartLineLabel(line)}</p>
                          )}
                          <p className="mt-1 text-sm font-medium tabular-nums text-zinc-800">
                            ${((line.priceCents * line.quantity) / 100).toFixed(2)}
                          </p>
                        </div>
                        <QuickCartLineControls
                          cartId={cart.id}
                          cartItemId={line.id}
                          quantity={line.quantity}
                          onUpdated={async (next) => {
                            if (next) setCart(next);
                            else {
                              await refreshCart();
                              router.refresh();
                            }
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

        <footer className="border-t border-zinc-100 bg-white px-4 py-4 sm:px-5">
          {cart && cart.items.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="text-base font-bold tabular-nums text-black">
                  ${(cart.subtotalCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
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
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            <Link href="/cart" className="font-medium text-zinc-700 hover:underline" onClick={closeCart}>
              Open full cart page
            </Link>
          </p>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
