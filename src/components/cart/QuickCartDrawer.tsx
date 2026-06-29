"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuickCart } from "@/components/cart/QuickCartContext";
import { AwaitCartNavigationLink } from "@/components/cart/AwaitCartNavigationLink";
import { QuickCartLineControls } from "@/components/cart/QuickCartLineControls";
import { QuickCartHeader } from "@/components/cart/QuickCartHeader";
import { QuickCartGroupSection } from "@/components/cart/QuickCartGroupSection";
import { QuickCartActiveRecoverySection } from "@/components/cart/QuickCartActiveRecoverySection";
import { ButtonLink } from "@/components/ui/button";
import { shouldSuppressNeutralGroupPromo } from "@/lib/quick-cart-active-recovery";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { quickCartEmptyTitle, quickCartFooterCtaLabel, quickCartHasActiveGroupOrder } from "@/lib/quick-cart-display";

export function QuickCartDrawer() {
  const {
    enabled,
    isOpen,
    closeCart,
    cart,
    podContext,
    activeCartRecovery,
    showActiveRecovery,
    loading,
    hasServerSession,
    clearActiveSoloCart,
    clearAndSwitchSoloCart,
  } = useQuickCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!enabled || !mounted || !isOpen) return null;

  const groupOrder = cart?.groupOrder;
  const canCheckout = groupOrder?.canCheckout ?? true;
  const isParticipant = groupOrder?.role === "participant";
  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const hasItems = Boolean(cart && cart.items.length > 0);
  const hasActiveGroupOrder = quickCartHasActiveGroupOrder(cart);
  const showHostGroupEmpty =
    Boolean(cart && groupOrder?.role === "host" && groupOrder.joinCode && !hasItems);
  const showParticipantGroupEmpty = Boolean(cart && isParticipant && !hasItems);
  const showGroupOrderFooter = Boolean(cart && (hasItems || showHostGroupEmpty || showParticipantGroupEmpty));
  const footerCta = quickCartFooterCtaLabel({
    hasItems,
    groupRole: groupOrder?.role,
    canCheckout,
    cartScope: podContext.cartScope,
  });
  const showNeutralEmpty =
    podContext.cartScope === "neutral" &&
    !hasItems &&
    !showActiveRecovery &&
    !hasActiveGroupOrder &&
    !showHostGroupEmpty;
  const showBrowsingEmpty =
    podContext.cartScope === "browsing_pod" &&
    !hasItems &&
    !podContext.requiresClearToSwitchPod &&
    !showActiveRecovery &&
    !hasActiveGroupOrder &&
    !showHostGroupEmpty;
  const suppressNeutralGroupPromo =
    showActiveRecovery && shouldSuppressNeutralGroupPromo(activeCartRecovery);

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
        <QuickCartHeader podContext={podContext} onClose={closeCart} onNavigate={closeCart} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {showActiveRecovery && activeCartRecovery ? (
            <QuickCartActiveRecoverySection
              recovery={activeCartRecovery}
              browsingPodName={podContext.browsingPodName}
              onNavigate={closeCart}
              onClearAndSwitch={
                activeCartRecovery.kind === "solo_cart" ? clearAndSwitchSoloCart : undefined
              }
              onClearCart={
                activeCartRecovery.kind === "solo_cart" ? clearActiveSoloCart : undefined
              }
            />
          ) : null}

          <QuickCartGroupSection
            cart={cart}
            podContext={podContext}
            hasServerSession={hasServerSession}
            suppressNeutralGroupPromo={suppressNeutralGroupPromo}
            onNavigate={closeCart}
          />

          {loading && !cart && !showActiveRecovery && !hasActiveGroupOrder ? (
            <p className="text-sm text-oo-stone-gray">Loading cart…</p>
          ) : showNeutralEmpty ? (
            <div className="oo-empty-state px-6 py-10">
              <p className="font-semibold text-oo-charcoal">Your cart is empty</p>
              <p className="mt-2 text-sm text-oo-stone-gray">{quickCartEmptyTitle(podContext)}</p>
              <ButtonLink href="/explore" variant="secondary" size="sm" className="mt-6">
                Explore pods
              </ButtonLink>
            </div>
          ) : showBrowsingEmpty ? (
            <div className="oo-empty-state px-6 py-10">
              <p className="font-semibold text-oo-charcoal">Your cart is empty</p>
              <p className="mt-2 text-sm text-oo-stone-gray">{quickCartEmptyTitle(podContext)}</p>
            </div>
          ) : cart && hasItems ? (
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
                          podId={cart.podId}
                          cartItemId={line.id}
                          quantity={line.quantity}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : showParticipantGroupEmpty && cart ? (
            <div className="oo-empty-state px-2 py-4">
              <p className="text-sm text-oo-stone-gray">
                Add your items before the host checks out.
              </p>
            </div>
          ) : showHostGroupEmpty && cart ? (
            <div className="oo-empty-state px-2 py-4">
              <p className="text-sm text-oo-stone-gray">
                Your group cart is ready. Add items from a vendor or open the full cart to invite
                friends.
              </p>
            </div>
          ) : null}
        </div>

        <footer className="border-t border-oo-light-stone bg-oo-warm-white px-4 py-4 sm:px-5">
          {hasItems && cart && (
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
          {((cart && hasItems) || showGroupOrderFooter) && cart && (
            <AwaitCartNavigationLink
              cartId={cart.id}
              href="/cart"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
              onClick={closeCart}
            >
              {footerCta}
            </AwaitCartNavigationLink>
          )}
          {showGroupOrderFooter && !hasItems ? (
            <p className="mt-1 text-[11px] text-oo-stone-gray">
              {isParticipant ? "Group order · host checks out for the group" : "Group order · host pays at checkout"}
            </p>
          ) : null}
          {showNeutralEmpty && (
            <ButtonLink
              href="/explore"
              variant="primary"
              size="sm"
              className="mt-4 w-full justify-center"
              onClick={closeCart}
            >
              Explore pods
            </ButtonLink>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  );
}
