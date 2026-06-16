"use client";

import { useCallback, useMemo, useState } from "react";
import { addToCartAction } from "@/actions/cart.actions";
import type { ModifierConfigForUI } from "@/app/pod/[podId]/vendor/[vendorId]/modifier-config";
import { useVendorMenuModifier } from "@/components/vendor-menu/VendorMenuModifierContext";
import { useVendorMenuCart } from "@/components/vendor-menu/VendorMenuCartContext";

export type MenuItemAddActionParams = {
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
};

export function useMenuItemAddAction({
  menuItemId,
  shellDeliverectPlu,
  modifierConfig,
  podId,
  vendorId,
  vendorName,
  menuItemName,
  unitPriceCents,
  orderingDisabled = false,
  vendorUsesDeliverect = false,
  menuItemDeliverectVariantParentPlu,
}: MenuItemAddActionParams) {
  const { openModifier } = useVendorMenuModifier();
  const { cartId: liveCartId, vendorCartItems, runSimpleAddToCart } = useVendorMenuCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasModifiers = Boolean(modifierConfig && modifierConfig.groups.length > 0);

  const linesForThisItem = useMemo(() => {
    const shellPlu = shellDeliverectPlu?.trim();
    return vendorCartItems.filter((i) => {
      if (i.menuItemId === menuItemId) return true;
      if (shellPlu && i.menuItem?.deliverectVariantParentPlu === shellPlu) return true;
      return false;
    });
  }, [vendorCartItems, menuItemId, shellDeliverectPlu]);

  const openModifierFlow = useCallback(() => {
    if (!modifierConfig || !liveCartId) return;
    openModifier({
      modifierConfig,
      cartId: liveCartId,
      podId,
      vendorId,
      vendorUsesDeliverect,
      menuItemDeliverectVariantParentPlu,
      returnFocusMenuItemId: menuItemId,
    });
    setError(null);
  }, [
    liveCartId,
    menuItemDeliverectVariantParentPlu,
    menuItemId,
    modifierConfig,
    openModifier,
    podId,
    vendorId,
    vendorUsesDeliverect,
  ]);

  const addDirect = useCallback(async () => {
    if (!liveCartId) return;
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
        add: () => addToCartAction(liveCartId, menuItemId, 1, undefined, undefined, podId),
      });
      if (!result.success) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setLoading(false);
    }
  }, [
    liveCartId,
    menuItemId,
    menuItemName,
    podId,
    runSimpleAddToCart,
    shellDeliverectPlu,
    unitPriceCents,
    vendorId,
    vendorName,
  ]);

  const triggerAddFlow = useCallback(() => {
    if (orderingDisabled || loading || !liveCartId) return;
    if (hasModifiers && modifierConfig) {
      openModifierFlow();
      return;
    }
    void addDirect();
  }, [
    addDirect,
    hasModifiers,
    liveCartId,
    loading,
    modifierConfig,
    openModifierFlow,
    orderingDisabled,
  ]);

  const openCustomizeAnother = useCallback(() => {
    if (orderingDisabled) return;
    openModifierFlow();
  }, [openModifierFlow, orderingDisabled]);

  return {
    liveCartId,
    loading,
    error,
    hasModifiers,
    linesForThisItem,
    triggerAddFlow,
    openCustomizeAnother,
    addDirect,
    buttonDisabled: loading || !liveCartId || orderingDisabled,
  };
}

export type MenuItemAddAction = ReturnType<typeof useMenuItemAddAction>;

export { handleMenuItemCardKeyDown } from "@/lib/menu-item-card-keydown";
