"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction } from "@/actions/cart.actions";
import { ModifierModal } from "./ModifierModal";
import type { ModifierConfigForUI } from "./modifier-config";

export function AddToCartButton({
  cartId,
  menuItemId,
  menuItemName,
  priceCents,
  modifierConfig,
  vendorUnavailable = false,
}: {
  cartId: string;
  menuItemId: string;
  menuItemName: string;
  priceCents: number;
  modifierConfig?: ModifierConfigForUI;
  vendorUnavailable?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const hasModifiers = modifierConfig && modifierConfig.groups.length > 0;

  async function addDirect() {
    setLoading(true);
    setError(null);
    try {
      const result = await addToCartAction(cartId, menuItemId, 1);
      if (result.success) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (vendorUnavailable) return;
    if (hasModifiers) {
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
        disabled={loading || !cartId || vendorUnavailable}
        className="rounded-lg border border-mennyu-primary bg-white px-4 py-2 text-sm font-medium text-black hover:bg-mennyu-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {vendorUnavailable
          ? "Not available"
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
          onClose={() => setModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
