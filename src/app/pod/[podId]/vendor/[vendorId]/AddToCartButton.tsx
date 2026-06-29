"use client";

import { useMemo } from "react";
import type { ModifierConfigForUI } from "./modifier-config";
import { useVendorMenuCart } from "@/components/vendor-menu/VendorMenuCartContext";
import type { Cart, CartItem } from "@/domain/types";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import {
  optimisticDecrementCartItemMutation,
  optimisticIncrementCartItemMutation,
} from "@/lib/cart-optimistic-line-mutations";
import {
  useMenuItemAddAction,
  type MenuItemAddAction,
  type MenuItemAddActionParams,
} from "@/components/vendor-menu/useMenuItemAddAction";

function stopOverlayBubble(event: React.MouseEvent) {
  event.stopPropagation();
}

function CartLineQtyControls({
  cartId,
  podId,
  line,
  orderingDisabled,
  onUpdated,
  compact = false,
  overlay = false,
}: {
  cartId: string;
  podId: string;
  line: CartItem;
  orderingDisabled: boolean;
  onUpdated: (cart: Cart) => void;
  compact?: boolean;
  overlay?: boolean;
}) {
  const { cart, applyLocalCartUpdate, getCartSnapshot } = useVendorMenuCart();
  const liveLine = cart.items.find((item) => item.id === line.id) ?? line;
  const quantity = liveLine.quantity;

  const mutationBase = {
    cartId,
    podId,
    cartItemId: line.id,
    source: "vendor-menu" as const,
    getCurrentCart: getCartSnapshot,
    applyLocal: applyLocalCartUpdate,
  };

  async function decrement() {
    if (orderingDisabled) return;
    const result = await optimisticDecrementCartItemMutation(mutationBase);
    if (result.success) {
      onUpdated(result.cart);
    }
  }

  async function increment() {
    if (orderingDisabled) return;
    const result = await optimisticIncrementCartItemMutation(mutationBase);
    if (result.success) {
      onUpdated(result.cart);
    }
  }

  const shell = overlay
    ? "inline-flex w-auto shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-white/95 px-0.5 py-0.5 shadow-sm backdrop-blur-sm"
    : compact
      ? "flex w-full items-center justify-between gap-1 rounded-md border border-oo-light-stone bg-oo-warm-white px-0.5 py-0.5"
      : "flex items-center gap-1 rounded-lg border border-oo-light-stone bg-oo-warm-white px-1 py-0.5 shadow-sm";

  const btnClass = overlay
    ? "flex h-11 min-w-[2.75rem] items-center justify-center rounded-full text-base font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40 sm:h-9 sm:min-w-[2rem] sm:text-sm"
    : compact
      ? "flex h-11 min-w-[2.75rem] items-center justify-center rounded text-base font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40 sm:h-7 sm:min-w-[1.75rem]"
      : "flex h-11 min-w-[2.75rem] items-center justify-center rounded-md text-lg font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40 sm:h-9 sm:min-w-[2.25rem]";

  const qtyClass = overlay
    ? "min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-oo-charcoal sm:min-w-[1.1rem] sm:text-[11px]"
    : compact
      ? "min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-oo-charcoal"
      : "min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-oo-charcoal";

  return (
    <div className={shell} onClick={overlay ? stopOverlayBubble : undefined}>
      <button
        type="button"
        disabled={orderingDisabled}
        onClick={(event) => {
          if (overlay) stopOverlayBubble(event);
          void decrement();
        }}
        className={btnClass}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={qtyClass}>{quantity}</span>
      <button
        type="button"
        disabled={orderingDisabled}
        onClick={(event) => {
          if (overlay) stopOverlayBubble(event);
          void increment();
        }}
        className={btnClass}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function AddToCartButtonView({
  menuItemId,
  modifierConfig,
  podId,
  orderingDisabled = false,
  displayMode = "default",
  addAction,
}: {
  menuItemId: string;
  modifierConfig?: ModifierConfigForUI;
  podId: string;
  orderingDisabled?: boolean;
  displayMode?: "default" | "card" | "card-overlay";
  addAction: MenuItemAddAction;
}) {
  const isCardOverlay = displayMode === "card-overlay";
  const isCard = displayMode === "card" || isCardOverlay;

  const {
    loading,
    error,
    hasModifiers,
    linesForThisItem,
    triggerAddFlow,
    openCustomizeAnother,
    buttonDisabled,
    liveCartId,
  } = addAction;

  const showInitialAdd = linesForThisItem.length === 0;
  const overlayActionRow = "flex max-w-full flex-wrap items-center justify-end gap-1.5";

  const handleAddClick = (event: React.MouseEvent) => {
    if (isCardOverlay) stopOverlayBubble(event);
    triggerAddFlow();
  };

  return (
    <div
      className={
        isCardOverlay
          ? "flex w-full flex-col items-end gap-1"
          : isCard
            ? "flex w-full flex-col items-stretch gap-1.5"
            : "flex w-full max-w-[min(100%,20rem)] flex-col items-stretch gap-2 sm:items-end"
      }
      onClick={isCardOverlay ? stopOverlayBubble : undefined}
    >
      {error && (
        <p
          className={
            isCardOverlay
              ? "max-w-full text-right text-[10px] font-medium text-red-200"
              : "text-xs text-brand"
          }
          role="alert"
        >
          {error}
        </p>
      )}

      {showInitialAdd ? (
        <button
          type="button"
          data-cart-focus-menu-item={menuItemId}
          onClick={handleAddClick}
          disabled={buttonDisabled}
          className={
            isCardOverlay
              ? "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-base font-semibold text-zinc-900 shadow-md transition hover:bg-brand hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
              : isCard
                ? "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-oo-charcoal px-3 py-2 text-xs font-semibold text-oo-warm-white transition hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                : "rounded-xl border-2 border-oo-charcoal bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal shadow-sm transition duration-200 hover:bg-oo-cream hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-charcoal active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          }
        >
          {orderingDisabled
            ? "Unavailable"
            : loading
              ? "Adding…"
              : isCardOverlay
                ? "Add"
                : isCard
                  ? "Add"
                  : "Add to cart"}
        </button>
      ) : isCardOverlay ? (
        <div className={overlayActionRow}>
          {hasModifiers && modifierConfig && (
            <button
              type="button"
              data-cart-focus-menu-item={menuItemId}
              onClick={(event) => {
                stopOverlayBubble(event);
                openCustomizeAnother();
              }}
              disabled={orderingDisabled}
              className="min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-white/95 underline decoration-white/50 underline-offset-2 transition hover:text-white hover:decoration-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-2 sm:py-1 sm:text-[11px]"
              aria-label="Customize another"
            >
              Customize
            </button>
          )}
          {linesForThisItem.map((line) => (
            <div key={line.id} className="flex max-w-full shrink-0 items-center gap-1">
              {hasModifiers && linesForThisItem.length > 1 && (
                <span
                  className="max-w-[5.5rem] truncate text-[10px] font-medium text-white/90 sm:max-w-[7rem]"
                  title={shortCartLineLabel(line)}
                >
                  {shortCartLineLabel(line)}
                </span>
              )}
              <CartLineQtyControls
                cartId={liveCartId}
                podId={podId}
                line={line}
                orderingDisabled={orderingDisabled}
                onUpdated={() => {}}
                compact={isCard}
                overlay
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-1.5">
          {linesForThisItem.map((line) => (
            <div
              key={line.id}
              className={
                isCard
                  ? "flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1.5"
                  : "flex flex-col gap-1 rounded-lg border border-stone-200 bg-stone-50/80 p-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3"
              }
            >
              {hasModifiers && linesForThisItem.length > 1 && (
                <p
                  className={
                    isCard
                      ? "truncate text-left text-[10px] text-zinc-600"
                      : "truncate text-left text-xs text-stone-600 sm:max-w-[10rem] sm:flex-1"
                  }
                  title={shortCartLineLabel(line)}
                >
                  {shortCartLineLabel(line)}
                </p>
              )}
              <CartLineQtyControls
                cartId={liveCartId}
                podId={podId}
                line={line}
                orderingDisabled={orderingDisabled}
                onUpdated={() => {}}
                compact={isCard}
              />
            </div>
          ))}
          {hasModifiers && modifierConfig && (
            <button
              type="button"
              data-cart-focus-menu-item={menuItemId}
              onClick={openCustomizeAnother}
              disabled={orderingDisabled}
              className={
                isCard
                  ? "w-full rounded-md border border-dashed border-zinc-300 bg-white px-2 py-1.5 text-center text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  : "w-full rounded-lg border border-dashed border-stone-400 bg-white px-3 py-2 text-center text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-end"
              }
            >
              Customize another
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AddToCartButton({
  cartId: _cartId,
  addAction: addActionProp,
  ...params
}: MenuItemAddActionParams & {
  cartId: string;
  displayMode?: "default" | "card" | "card-overlay";
  addAction?: MenuItemAddAction;
}) {
  if (addActionProp) {
    return (
      <AddToCartButtonView
        menuItemId={params.menuItemId}
        modifierConfig={params.modifierConfig}
        podId={params.podId}
        orderingDisabled={params.orderingDisabled}
        displayMode={params.displayMode}
        addAction={addActionProp}
      />
    );
  }

  return <AddToCartButtonWithHook {...params} />;
}

function AddToCartButtonWithHook(
  params: MenuItemAddActionParams & {
    displayMode?: "default" | "card" | "card-overlay";
  }
) {
  const addAction = useMenuItemAddAction(params);
  return (
    <AddToCartButtonView
      menuItemId={params.menuItemId}
      modifierConfig={params.modifierConfig}
      podId={params.podId}
      orderingDisabled={params.orderingDisabled}
      displayMode={params.displayMode}
      addAction={addAction}
    />
  );
}
