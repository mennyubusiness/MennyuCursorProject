"use server";

import { serializeModifierConfig, mergeVariantParentAndLeafModifierConfig } from "@/lib/modifier-config";
import {
  loadMenuItemForVariantResolution,
  resolveDeliverectVariantLeafForCartLine,
} from "@/services/cart-deliverect-variant-resolution";
import { CartValidationError } from "@/services/cart-validation-error";

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

/**
 * For Deliverect variant families, the vendor page loads modifier groups from the **parent shell** only.
 * Required groups that exist only on the **leaf** (e.g. crust) must be merged into the modal after
 * the customer picks a size. Non-variant items are unchanged (caller should skip when not variant).
 */
export async function getVariantMergedModifierConfigAction(
  parentMenuItemId: string,
  selections: CartItemSelectionInput[]
) {
  const parent = await loadMenuItemForVariantResolution(parentMenuItemId);
  if (!parent) return null;

  const hasVariantGroup = parent.modifierGroups.some(
    (l) => l.modifierGroup.deliverectIsVariantGroup === true
  );
  if (!hasVariantGroup) {
    return { config: serializeModifierConfig(parent) };
  }

  try {
    const { menuItem: leaf } = await resolveDeliverectVariantLeafForCartLine({
      menuItem: parent,
      selections,
    });
    const parentConfig = serializeModifierConfig(parent);
    const leafConfig = serializeModifierConfig(leaf);
    const config = mergeVariantParentAndLeafModifierConfig(parentConfig, leafConfig, {
      menuItemName: leaf.name,
      priceCents: leaf.priceCents,
    });
    return { config };
  } catch (e) {
    if (e instanceof CartValidationError) {
      return { config: serializeModifierConfig(parent) };
    }
    throw e;
  }
}
