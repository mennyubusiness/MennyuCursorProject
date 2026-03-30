"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction } from "@/actions/cart.actions";
import { ModifierModal } from "./ModifierModal";
import type { ModifierConfigForUI } from "./modifier-config";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

export function AddToCartButton({
  cartId,
  menuItemId,
  menuItemName,
  priceCents,
  modifierConfig,
  podId,
  vendorId,
  /** True when vendor is closed/paused or this menu item is snoozed / unavailable. */
  orderingDisabled = false,
}: {
  cartId: string;
  menuItemId: string;
  menuItemName: string;
  priceCents: number;
  modifierConfig?: ModifierConfigForUI;
  podId: string;
  vendorId: string;
  orderingDisabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const hasModifiers = modifierConfig && modifierConfig.groups.length > 0;
  const buttonDisabled = loading || !cartId || orderingDisabled;

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
    });
  }, [menuItemId, vendorId, podId, cartId, orderingDisabled, buttonDisabled, hasModifiers]);

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
        setDone(true);
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

  function handleClick() {
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
    setDone(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={buttonDisabled}
        className="rounded-lg border border-mennyu-primary bg-white px-4 py-2 text-sm font-medium text-black hover:bg-mennyu-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {orderingDisabled
          ? "Unavailable"
          : loading
            ? "Adding…"
            : done
              ? "Added"
              : "Add to cart"}
      </button>
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
