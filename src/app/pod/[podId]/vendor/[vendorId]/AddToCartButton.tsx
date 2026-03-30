"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import { ModifierModal } from "./ModifierModal";
import type { ModifierConfigForUI } from "./modifier-config";
import type { CartItem } from "@/domain/types";
import { shortCartLineLabel } from "@/lib/cart-line-identity";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

function CartLineQtyControls({
  cartId,
  line,
  orderingDisabled,
  onUpdated,
}: {
  cartId: string;
  line: CartItem;
  orderingDisabled: boolean;
  onUpdated: () => void;
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

  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-1 py-0.5 shadow-sm">
      <button
        type="button"
        disabled={orderingDisabled || loading}
        onClick={() => void setQty(line.quantity - 1)}
        className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-md text-lg font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-stone-900">{line.quantity}</span>
      <button
        type="button"
        disabled={orderingDisabled || loading}
        onClick={() => void setQty(line.quantity + 1)}
        className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-md text-lg font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-40"
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
  modifierConfig,
  podId,
  vendorId,
  /** Cart lines for this vendor — used to match configured lines for qty controls. */
  vendorCartItems,
  /** True when vendor is closed/paused or this menu item is snoozed / unavailable. */
  orderingDisabled = false,
}: {
  cartId: string;
  menuItemId: string;
  modifierConfig?: ModifierConfigForUI;
  podId: string;
  vendorId: string;
  vendorCartItems: CartItem[];
  orderingDisabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const hasModifiers = Boolean(modifierConfig && modifierConfig.groups.length > 0);
  const buttonDisabled = loading || !cartId || orderingDisabled;

  const linesForThisItem = useMemo(
    () => vendorCartItems.filter((i) => i.menuItemId === menuItemId),
    [vendorCartItems, menuItemId]
  );

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
    if (hasModifiers) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[AddToCartButton] opening modifier modal");
      }
      setModalOpen(true);
      setError(null);
    } else {
      addDirect();
    }
  }

  function handleModalSuccess() {
    router.refresh();
  }

  function openCustomizeAnother() {
    setModalOpen(true);
    setError(null);
  }

  const showInitialAdd = linesForThisItem.length === 0;

  return (
    <div className="flex w-full max-w-[min(100%,20rem)] flex-col items-stretch gap-2 sm:items-end">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {showInitialAdd ? (
        <button
          type="button"
          onClick={handleClickAdd}
          disabled={buttonDisabled}
          className="rounded-lg border border-mennyu-primary bg-white px-4 py-2 text-sm font-medium text-black hover:bg-mennyu-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {orderingDisabled ? "Unavailable" : loading ? "Adding…" : "Add to cart"}
        </button>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {linesForThisItem.map((line) => (
            <div
              key={line.id}
              className="flex flex-col gap-1 rounded-lg border border-stone-200 bg-stone-50/80 p-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3"
            >
              {hasModifiers && linesForThisItem.length > 1 && (
                <p className="truncate text-left text-xs text-stone-600 sm:max-w-[10rem] sm:flex-1" title={shortCartLineLabel(line)}>
                  {shortCartLineLabel(line)}
                </p>
              )}
              <CartLineQtyControls
                cartId={cartId}
                line={line}
                orderingDisabled={orderingDisabled}
                onUpdated={() => router.refresh()}
              />
            </div>
          ))}
          {hasModifiers && modifierConfig && (
            <button
              type="button"
              onClick={openCustomizeAnother}
              disabled={orderingDisabled}
              className="w-full rounded-lg border border-dashed border-stone-400 bg-white px-3 py-2 text-center text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-end"
            >
              Customize another
            </button>
          )}
        </div>
      )}

      {hasModifiers && modalOpen && modifierConfig && (
        <ModifierModal
          config={modifierConfig}
          cartId={cartId}
          podId={podId}
          vendorId={vendorId}
          onClose={() => setModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
