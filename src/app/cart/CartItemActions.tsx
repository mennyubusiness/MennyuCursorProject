"use client";

import { useState } from "react";
import { updateCartItemAction, removeFromCartAction } from "@/actions/cart.actions";
import { dispatchCartUpdated } from "@/lib/cart-client-sync";
import { applyCartMutationClientResult } from "@/lib/cart-mutation-client-result";
import { enqueueCartMutation } from "@/lib/cart-mutation-queue";
import type { Cart } from "@/domain/types";
import { ModifierModal } from "@/components/ModifierModal";
import type { ModifierConfigForUI } from "@/lib/modifier-config";
import { CartPageLiveQuantity } from "./CartPageMutationSync";

function publishCartPageMutation(cart: Cart | null | undefined): void {
  if (!cart) return;
  dispatchCartUpdated({ cart, source: "cart-page" });
}

/**
 * Cart item quantity, special instructions, remove, and (for configurable items) modifier edit.
 * When modifierConfig is provided, Edit opens the same modifier UI used at add-to-cart.
 */
export function CartItemActions({
  cartId,
  podId,
  cartItemId,
  quantity,
  specialInstructions,
  modifierConfig,
  initialSelections,
  vendorUsesDeliverect = false,
  menuItemDeliverectVariantParentPlu,
  /** When set, line is view-only (group lock or not your item). */
  interactionDisabled = false,
  interactionDisabledReason,
}: {
  cartId: string;
  podId: string;
  cartItemId: string;
  quantity: number;
  specialInstructions?: string | null;
  modifierConfig?: ModifierConfigForUI;
  initialSelections?: Array<{ modifierOptionId: string; quantity: number }>;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
  interactionDisabled?: boolean;
  interactionDisabledReason?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editInstructions, setEditInstructions] = useState(specialInstructions ?? "");
  const [modifierModalOpen, setModifierModalOpen] = useState(false);

  const hasModifiers = modifierConfig && modifierConfig.groups.length > 0;

  if (interactionDisabled) {
    return (
      <div className="text-right text-xs text-stone-500">
        <span className="font-medium text-stone-600">View only</span>
        {interactionDisabledReason ? (
          <p className="mt-1 max-w-[14rem] text-stone-500">{interactionDisabledReason}</p>
        ) : null}
      </div>
    );
  }

  async function updateQuantity(q: number) {
    setError(null);
    setLoading(true);
    try {
      const result = await enqueueCartMutation(cartId, () =>
        updateCartItemAction(cartId, cartItemId, q, specialInstructions ?? null, undefined, podId)
      );
      applyCartMutationClientResult({
        result: result ?? undefined,
        applyCart: publishCartPageMutation,
        setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveInstructions() {
    setError(null);
    setLoading(true);
    try {
      const value = editInstructions.trim() || null;
      const result = await enqueueCartMutation(cartId, () =>
        updateCartItemAction(cartId, cartItemId, quantity, value, undefined, podId)
      );
      if (
        applyCartMutationClientResult({
          result: result ?? undefined,
          applyCart: publishCartPageMutation,
          setError,
        })
      ) {
        setEditing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setError(null);
    setLoading(true);
    try {
      const result = await enqueueCartMutation(cartId, () =>
        removeFromCartAction(cartId, cartItemId, podId)
      );
      applyCartMutationClientResult({
        result,
        applyCart: publishCartPageMutation,
        setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => updateQuantity(Math.max(0, quantity - 1))}
          disabled={loading || quantity <= 1}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-oo-light-stone text-lg font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50 sm:h-8 sm:w-8 sm:text-base"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="min-w-[2ch] text-center text-base font-semibold tabular-nums sm:text-sm">
          <CartPageLiveQuantity cartItemId={cartItemId} fallback={quantity} />
        </span>
        <button
          type="button"
          onClick={() => updateQuantity(quantity + 1)}
          disabled={loading}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-oo-light-stone text-lg font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50 sm:h-8 sm:w-8 sm:text-base"
          aria-label="Increase quantity"
        >
          +
        </button>
        {!editing && !modifierModalOpen && (
          <button
            type="button"
            onClick={() => {
              if (hasModifiers) {
                setModifierModalOpen(true);
                setError(null);
              } else {
                setEditInstructions(specialInstructions ?? "");
                setEditing(true);
              }
            }}
            disabled={loading}
            className="ml-1 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-oo-charcoal hover:underline sm:min-h-0 sm:px-2"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-red-700 hover:underline sm:min-h-0 sm:px-2"
        >
          Remove
        </button>
      </div>
      {hasModifiers && modifierModalOpen && modifierConfig && (
        <ModifierModal
          config={modifierConfig}
          cartId={cartId}
          cartItemId={cartItemId}
          quantity={quantity}
          initialSelections={initialSelections}
          initialSpecialInstructions={specialInstructions}
          cartUpdateSource="cart-page"
          onClose={() => setModifierModalOpen(false)}
          onSuccess={() => {
            setModifierModalOpen(false);
          }}
          vendorUsesDeliverect={vendorUsesDeliverect}
          menuItemDeliverectVariantParentPlu={menuItemDeliverectVariantParentPlu}
        />
      )}
      {editing && (
        <div className="rounded border border-stone-200 bg-stone-50 p-2">
          <label htmlFor={`instructions-${cartItemId}`} className="sr-only">
            Special instructions
          </label>
          <textarea
            id={`instructions-${cartItemId}`}
            value={editInstructions}
            onChange={(e) => setEditInstructions(e.target.value)}
            placeholder="e.g. No onions"
            rows={2}
            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveInstructions}
              disabled={loading}
              className="rounded border border-stone-900 bg-stone-900 px-2 py-1 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditInstructions(specialInstructions ?? "");
              }}
              disabled={loading}
              className="rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
