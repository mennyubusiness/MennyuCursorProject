"use server";

import type { ModifierConfigForUI } from "@/lib/modifier-config";
import { serializeModifierConfig, mergeVariantParentAndLeafModifierConfig } from "@/lib/modifier-config";
import {
  loadMenuItemForVariantResolution,
  resolveDeliverectVariantLeafForCartLine,
} from "@/services/cart-deliverect-variant-resolution";
import { CartValidationError } from "@/services/cart-validation-error";
import {
  loadMenuItemForSerializeConfig,
  getCartEditModifierModalPayloadSingle,
  type CartItemSelectionInput,
} from "@/services/cart-edit-modal-payload.service";

export type { CartItemSelectionInput };

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

/**
 * Cart "Edit" uses {@link ModifierModal} with `cartItemId` — the client skips
 * {@link getVariantMergedModifierConfigAction}, so we must supply parent-shell variant groups (size)
 * merged with the leaf graph here. Also re-inject the size option into `initialSelections` because
 * the cart line omits variant rows from persisted selections.
 *
 * For /cart SSR, prefer {@link loadCartEditModifierPayloadsForCartPage} (batched).
 */
export async function getCartEditModifierModalPayload(
  leafMenuItemId: string,
  persistedSelections: CartItemSelectionInput[]
): Promise<{ config: ModifierConfigForUI; initialSelections: CartItemSelectionInput[] } | null> {
  return getCartEditModifierModalPayloadSingle(leafMenuItemId, persistedSelections);
}
