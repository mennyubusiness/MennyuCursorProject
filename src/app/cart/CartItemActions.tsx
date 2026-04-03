"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCartItemAction, removeFromCartAction } from "@/actions/cart.actions";
import { ModifierModal } from "@/components/ModifierModal";
import type { ModifierConfigForUI } from "@/lib/modifier-config";

/**
 * Cart item quantity, special instructions, remove, and (for configurable items) modifier edit.
 * When modifierConfig is provided, Edit opens the same modifier UI used at add-to-cart.
 */
export function CartItemActions({
  cartId,
  cartItemId,
  quantity,
  specialInstructions,
  modifierConfig,
  initialSelections,
  vendorUsesDeliverect = false,
  menuItemDeliverectVariantParentPlu,
}: {
  cartId: string;
  cartItemId: string;
  quantity: number;
  specialInstructions?: string | null;
  modifierConfig?: ModifierConfigForUI;
  initialSelections?: Array<{ modifierOptionId: string; quantity: number }>;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editInstructions, setEditInstructions] = useState(specialInstructions ?? "");
  const [modifierModalOpen, setModifierModalOpen] = useState(false);

  const hasModifiers = modifierConfig && modifierConfig.groups.length > 0;

  async function refresh() {
    router.refresh();
  }

  async function updateQuantity(q: number) {
    setError(null);
    setLoading(true);
    try {
      const result = await updateCartItemAction(cartId, cartItemId, q, specialInstructions ?? null);
      if (result?.success) await refresh();
      else if (result && !result.success) setError(result.error);
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
      const result = await updateCartItemAction(cartId, cartItemId, quantity, value);
      if (result?.success) {
        setEditing(false);
        await refresh();
      } else if (result && !result.success) setError(result.error);
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
      await removeFromCartAction(cartId, cartItemId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => updateQuantity(Math.max(0, quantity - 1))}
          disabled={loading || quantity <= 1}
          className="h-8 w-8 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-50"
        >
          −
        </button>
        <span className="w-6 text-center text-sm">{quantity}</span>
        <button
          type="button"
          onClick={() => updateQuantity(quantity + 1)}
          disabled={loading}
          className="h-8 w-8 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-50"
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
            className="ml-2 text-sm text-mennyu-primary hover:underline"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="ml-2 text-sm text-red-600 hover:underline"
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
          onClose={() => setModifierModalOpen(false)}
          onSuccess={() => {
            setModifierModalOpen(false);
            refresh();
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
              className="rounded border border-mennyu-primary bg-mennyu-primary px-2 py-1 text-sm font-medium text-black hover:bg-mennyu-secondary disabled:opacity-50"
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
