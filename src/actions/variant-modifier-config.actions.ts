"use server";

import { prisma } from "@/lib/db";
import { serializeModifierConfig, mergeVariantParentAndLeafModifierConfig } from "@/lib/modifier-config";
import { CUSTOMER_VENDOR_MENU_ITEM_INCLUDE } from "@/services/vendor-customer-menu.service";
import {
  loadMenuItemForVariantResolution,
  resolveDeliverectVariantLeafForCartLine,
} from "@/services/cart-deliverect-variant-resolution";
import { CartValidationError } from "@/services/cart-validation-error";

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

/** Full graph for `serializeModifierConfig` (variant resolution uses a slimmer include). */
async function loadMenuItemForSerializeConfig(menuItemId: string) {
  return prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  });
}

/**
 * For Deliverect variant families, the vendor page loads modifier groups from the **parent shell** only.
 * Required groups that exist only on the **leaf** (e.g. crust) must be merged into the modal after
 * the customer picks a size. Non-variant items are unchanged (caller should skip when not variant).
 */
export async function getVariantMergedModifierConfigAction(
  parentMenuItemId: string,
  selections: CartItemSelectionInput[]
) {
  const parentSlim = await loadMenuItemForVariantResolution(parentMenuItemId);
  if (!parentSlim) return null;

  const parentFull = await loadMenuItemForSerializeConfig(parentMenuItemId);
  if (!parentFull) return null;

  const hasVariantGroup = parentSlim.modifierGroups.some(
    (l) => l.modifierGroup.deliverectIsVariantGroup === true
  );
  if (!hasVariantGroup) {
    return { config: serializeModifierConfig(parentFull) };
  }

  try {
    const { menuItem: leafSlim } = await resolveDeliverectVariantLeafForCartLine({
      menuItem: parentSlim,
      selections,
    });
    const leafFull = await loadMenuItemForSerializeConfig(leafSlim.id);
    if (!leafFull) {
      return { config: serializeModifierConfig(parentFull) };
    }
    const parentConfig = serializeModifierConfig(parentFull);
    const leafConfig = serializeModifierConfig(leafFull);
    const config = mergeVariantParentAndLeafModifierConfig(parentConfig, leafConfig, {
      menuItemName: leafFull.name,
    });
    return { config };
  } catch (e) {
    if (e instanceof CartValidationError) {
      return { config: serializeModifierConfig(parentFull) };
    }
    throw e;
  }
}
