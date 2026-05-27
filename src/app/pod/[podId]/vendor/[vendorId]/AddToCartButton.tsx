"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import { dispatchCartItemAdded } from "@/lib/cart-ui-feedback";
import type { ModifierConfigForUI } from "./modifier-config";
import { useVendorMenuModifier } from "@/components/vendor-menu/VendorMenuModifierContext";
import type { CartItem } from "@/domain/types";
import { shortCartLineLabel } from "@/lib/cart-line-identity";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

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
  onUpdated: () => void;
  compact?: boolean;
  overlay?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function setQty(next: number) {
    if (orderingDisabled) return;
    setLoading(true);
    try {
      const result = await updateCartItemAction(cartId, line.id, next, undefined, undefined);
      if (result?.success) {
        onUpdated();
      }
    } finally {
      setLoading(false);
    }
  }

  const shell = overlay
    ? "inline-flex w-auto shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-white/95 px-0.5 py-0.5 shadow-sm backdrop-blur-sm"
    : compact
      ? "flex w-full items-center justify-between gap-1 rounded-md border border-zinc-200 bg-white px-0.5 py-0.5"
      : "flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-1 py-0.5 shadow-sm";

  const btnClass = overlay
    ? "flex h-6 min-w-[1.5rem] items-center justify-center rounded text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
    : compact
      ? "flex h-7 min-w-[1.75rem] items-center justify-center rounded text-base font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-40"
      : "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md text-lg font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-40";

  const qtyClass = overlay
    ? "min-w-[1.1rem] text-center text-[11px] font-semibold tabular-nums text-zinc-900"
    : compact
      ? "min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-zinc-900"
      : "min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-stone-900";

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
  /** Cart lines for this vendor — used to match configured lines for qty controls. */
  vendorCartItems,
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
  vendorCartItems: CartItem[];
  orderingDisabled?: boolean;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
  displayMode?: "default" | "card" | "card-overlay";
}) {
  const isCardOverlay = displayMode === "card-overlay";
  const isCard = displayMode === "card" || isCardOverlay;
  const router = useRouter();
  const { openModifier } = useVendorMenuModifier();
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

  useEffect(() => {
    if (!DEBUG_ADD_TO_CART_TRACE) return;
    console.log("[AddToCartButton] mount/props", {
      menuItemId,
      vendorId,
      podId,
      cartId: cartId || "(empty)",
      orderingDisabled,
      buttonDisabled,
      hasModifiers,
      linesForThisItem: linesForThisItem.length,
    });
  }, [menuItemId, vendorId, podId, cartId, orderingDisabled, buttonDisabled, hasModifiers, linesForThisItem.length]);

  async function addDirect() {
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.log("[AddToCartButton] addDirect → calling addToCartAction", {
        menuItemId,
        vendorId,
        podId,
        cartId,
      });
    }
    setLoading(true);
    setError(null);
    try {
      const result = await addToCartAction(cartId, menuItemId, 1);
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[AddToCartButton] addToCartAction returned", {
          success: result.success,
          error: "error" in result ? result.error : undefined,
          code: "code" in result ? result.code : undefined,
        });
      }
      if (result.success) {
        dispatchCartItemAdded();
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (e) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.error("[AddToCartButton] addDirect threw", e);
      }
      setError(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setLoading(false);
    }
  }

  function handleClickAdd() {
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.log("[AddToCartButton] clicked", {
        menuItemId,
        vendorId,
        podId,
        cartId: cartId || "(empty)",
        orderingDisabled,
        hasModifiers,
      });
    }
    if (orderingDisabled) return;
    if (hasModifiers && modifierConfig) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[AddToCartButton] opening modifier modal");
      }
      openModifier({
        modifierConfig,
        cartId,
        podId,
        vendorId,
        vendorUsesDeliverect,
        menuItemDeliverectVariantParentPlu,
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
          onClick={handleClickAdd}
          disabled={buttonDisabled}
          className={
            isCardOverlay
              ? "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-md transition hover:bg-brand hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
              : isCard
                ? "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                : "rounded-xl border-2 border-stone-900 bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition duration-200 hover:bg-stone-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
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
                onUpdated={() => router.refresh()}
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
                onUpdated={() => router.refresh()}
                compact={isCard}
              />
            </div>
          ))}
          {hasModifiers && modifierConfig && (
            <button
              type="button"
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
