"use client";

import { useMemo, useState } from "react";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import type { ModifierConfigForUI } from "./modifier-config";
import { useVendorMenuModifier } from "@/components/vendor-menu/VendorMenuModifierContext";
import { useVendorMenuCart } from "@/components/vendor-menu/VendorMenuCartContext";
import type { Cart, CartItem } from "@/domain/types";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { enqueueCartMutation } from "@/lib/cart-mutation-queue";

function CartLineQtyControls({
  cartId,
  line,
  orderingDisabled,
  onUpdated,
  compact = false,
  overlay = false,
}: {
  cartId: string;
  line: CartItem;
  orderingDisabled: boolean;
  onUpdated: (cart: Cart) => void;
  compact?: boolean;
  overlay?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { cart: snapshot, applyServerCart } = useVendorMenuCart();

  async function setQty(next: number) {
    if (orderingDisabled) return;
    setLoading(true);
    const before = snapshot;
    try {
      const result = await enqueueCartMutation(cartId, () =>
        updateCartItemAction(cartId, line.id, next, undefined, undefined)
      );
      if (result?.success) {
        applyServerCart(result.cart);
        onUpdated(result.cart);
      }
    } catch {
      applyServerCart(before);
    } finally {
      setLoading(false);
    }
  }

  const shell = overlay
    ? "inline-flex w-auto shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-white/95 px-0.5 py-0.5 shadow-sm backdrop-blur-sm"
    : compact
      ? "flex w-full items-center justify-between gap-1 rounded-md border border-oo-light-stone bg-oo-warm-white px-0.5 py-0.5"
      : "flex items-center gap-1 rounded-lg border border-oo-light-stone bg-oo-warm-white px-1 py-0.5 shadow-sm";

  const btnClass = overlay
    ? "flex h-6 min-w-[1.5rem] items-center justify-center rounded text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40"
    : compact
      ? "flex h-7 min-w-[1.75rem] items-center justify-center rounded text-base font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40"
      : "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md text-lg font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-40";

  const qtyClass = overlay
    ? "min-w-[1.1rem] text-center text-[11px] font-semibold tabular-nums text-oo-charcoal"
    : compact
      ? "min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-oo-charcoal"
      : "min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-oo-charcoal";

  return (
    <div className={shell}>
      <button
        type="button"
        disabled={orderingDisabled || loading}
        onClick={() => void setQty(line.quantity - 1)}
        className={btnClass}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={qtyClass}>{line.quantity}</span>
      <button
        type="button"
        disabled={orderingDisabled || loading}
        onClick={() => void setQty(line.quantity + 1)}
        className={btnClass}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function AddToCartButton({
  cartId,
  menuItemId,
  /** Parent shell Deliverect PLU — cart lines may store a leaf row whose `deliverectVariantParentPlu` matches. */
  shellDeliverectPlu,
  modifierConfig,
  podId,
  vendorId,
  vendorName,
  menuItemName,
  unitPriceCents,
  /** True when vendor is closed/paused or this menu item is snoozed / unavailable. */
  orderingDisabled = false,
  vendorUsesDeliverect = false,
  menuItemDeliverectVariantParentPlu,
  displayMode = "default",
}: {
  cartId: string;
  menuItemId: string;
  shellDeliverectPlu?: string | null;
  modifierConfig?: ModifierConfigForUI;
  podId: string;
  vendorId: string;
  vendorName: string;
  menuItemName: string;
  unitPriceCents: number;
  orderingDisabled?: boolean;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
  displayMode?: "default" | "card" | "card-overlay";
}) {
  const isCardOverlay = displayMode === "card-overlay";
  const isCard = displayMode === "card" || isCardOverlay;
  const { openModifier } = useVendorMenuModifier();
  const { vendorCartItems, runSimpleAddToCart } = useVendorMenuCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasModifiers = Boolean(modifierConfig && modifierConfig.groups.length > 0);
  const buttonDisabled = loading || !cartId || orderingDisabled;

  const linesForThisItem = useMemo(() => {
    const shellPlu = shellDeliverectPlu?.trim();
    return vendorCartItems.filter((i) => {
      if (i.menuItemId === menuItemId) return true;
      if (shellPlu && i.menuItem?.deliverectVariantParentPlu === shellPlu) return true;
      return false;
    });
  }, [vendorCartItems, menuItemId, shellDeliverectPlu]);

  async function addDirect() {
    setLoading(true);
    setError(null);
    try {
      const result = await runSimpleAddToCart({
        menuItemId,
        vendorId,
        vendorName,
        menuItemName,
        unitPriceCents,
        shellDeliverectPlu,
        add: () => addToCartAction(cartId, menuItemId, 1),
      });
      if (!result.success) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setLoading(false);
    }
  }

  function handleClickAdd() {
    if (orderingDisabled) return;
    if (hasModifiers && modifierConfig) {
      openModifier({
        modifierConfig,
        cartId,
        podId,
        vendorId,
        vendorUsesDeliverect,
        menuItemDeliverectVariantParentPlu,
        returnFocusMenuItemId: menuItemId,
      });
      setError(null);
    } else {
      addDirect();
    }
  }

  function openCustomizeAnother() {
    if (!modifierConfig) return;
    openModifier({
      modifierConfig,
      cartId,
      podId,
      vendorId,
      vendorUsesDeliverect,
      menuItemDeliverectVariantParentPlu,
      returnFocusMenuItemId: menuItemId,
    });
    setError(null);
  }

  const showInitialAdd = linesForThisItem.length === 0;

  const overlayActionRow = "flex max-w-full flex-wrap items-center justify-end gap-1.5";

  return (
    <div
      className={
        isCardOverlay
          ? "flex w-full flex-col items-end gap-1"
          : isCard
            ? "flex w-full flex-col items-stretch gap-1.5"
            : "flex w-full max-w-[min(100%,20rem)] flex-col items-stretch gap-2 sm:items-end"
      }
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
          onClick={handleClickAdd}
          disabled={buttonDisabled}
          className={
            isCardOverlay
              ? "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-md transition hover:bg-brand hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
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
              onClick={openCustomizeAnother}
              disabled={orderingDisabled}
              className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-white/95 underline decoration-white/50 underline-offset-2 transition hover:text-white hover:decoration-white disabled:cursor-not-allowed disabled:opacity-50"
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
                cartId={cartId}
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
                cartId={cartId}
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
