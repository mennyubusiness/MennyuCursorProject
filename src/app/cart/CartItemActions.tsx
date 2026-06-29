"use client";

import { useCallback, useState } from "react";
import { updateCartItemAction } from "@/actions/cart.actions";
import { ModifierModal } from "@/components/ModifierModal";
import type { ModifierConfigForUI } from "@/lib/modifier-config";
import { rebuildCartFromItems } from "@/lib/cart-totals";
import { runOptimisticCartMutation } from "@/lib/cart-optimistic-mutations";
import {
  optimisticDecrementCartItemMutation,
  optimisticIncrementCartItemMutation,
  optimisticRemoveCartItemMutation,
} from "@/lib/cart-optimistic-line-mutations";
import { CartPageLiveQuantity, useCartPageOptimisticMutations } from "./CartPageMutationSync";

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
  const { getCartSnapshot, applyLocalCartSnapshot } = useCartPageOptimisticMutations();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editInstructions, setEditInstructions] = useState(specialInstructions ?? "");
  const [modifierModalOpen, setModifierModalOpen] = useState(false);

  const hasModifiers = modifierConfig && modifierConfig.groups.length > 0;

  const getCurrentCart = useCallback(() => getCartSnapshot(), [getCartSnapshot]);
  const applyLocal = useCallback(
    (cart: import("@/domain/types").Cart) => {
      applyLocalCartSnapshot(cart);
    },
    [applyLocalCartSnapshot]
  );

  const mutationBase = {
    cartId,
    podId,
    cartItemId,
    source: "cart-page" as const,
    getCurrentCart,
    applyLocal,
    setError,
    specialInstructions: specialInstructions ?? null,
  };

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

  async function saveInstructions() {
    const value = editInstructions.trim() || null;
    const result = await runOptimisticCartMutation({
      ...mutationBase,
      applyOptimistic: (cart) => {
        const line = cart.items.find((item) => item.id === cartItemId);
        if (!line) return null;
        const items = cart.items.map((item) =>
          item.id === cartItemId ? { ...item, specialInstructions: value } : item
        );
        return rebuildCartFromItems(cart, items);
      },
      runServer: async () => {
        const result = await updateCartItemAction(
          cartId,
          cartItemId,
          quantity,
          value,
          undefined,
          podId
        );
        if (!result) {
          return { success: false, error: "We couldn't update your cart. Please try again." };
        }
        return result;
      },
    });
    if (result.success) {
      setEditing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void optimisticDecrementCartItemMutation(mutationBase)}
          disabled={quantity <= 1}
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
          onClick={() => void optimisticIncrementCartItemMutation(mutationBase)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-oo-light-stone text-lg font-medium text-oo-charcoal hover:bg-oo-cream sm:h-8 sm:w-8 sm:text-base"
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
            className="ml-1 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-oo-charcoal hover:underline sm:min-h-0 sm:px-2"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => void optimisticRemoveCartItemMutation(mutationBase)}
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
              onClick={() => void saveInstructions()}
              className="rounded border border-stone-900 bg-stone-900 px-2 py-1 text-sm font-medium text-white hover:bg-stone-800"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditInstructions(specialInstructions ?? "");
              }}
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
