import type { VendorMenuSourceFields } from "@/lib/vendor-menu-source";
import { isDeliverectMenuSource } from "@/lib/vendor-menu-source";

export const OPEN_ORDER_ITEM_NOT_ORDERABLE_MESSAGE =
  "This item is not currently available for online ordering. Please choose something else.";

export const DELIVERECT_ITEM_KITCHEN_MAPPING_MESSAGE =
  "This item is not available for online ordering until the kitchen menu mapping is fixed. Please choose something else.";

export const DELIVERECT_MODIFIER_NOT_ORDERABLE_MESSAGE =
  "A customization for this item is not available for online ordering. Try different options or contact the restaurant.";

/** Deliverect POS/kitchen PLU mapping is required only for active Deliverect menu vendors. */
export function vendorRequiresDeliverectKitchenMapping(
  vendor: Pick<VendorMenuSourceFields, "menuSource">
): boolean {
  return isDeliverectMenuSource(vendor);
}

export function deliverectItemKitchenMappingMessage(
  vendor: Pick<VendorMenuSourceFields, "menuSource">
): string {
  return vendorRequiresDeliverectKitchenMapping(vendor)
    ? DELIVERECT_ITEM_KITCHEN_MAPPING_MESSAGE
    : OPEN_ORDER_ITEM_NOT_ORDERABLE_MESSAGE;
}

export function validateDeliverectProductKitchenMapping(input: {
  vendor: Pick<VendorMenuSourceFields, "menuSource">;
  deliverectPlu?: string | null;
}): { ok: true } | { ok: false; code: "DELIVERECT_PLU_MISSING" } {
  if (!vendorRequiresDeliverectKitchenMapping(input.vendor)) {
    return { ok: true };
  }
  if (!input.deliverectPlu?.trim()) {
    return { ok: false, code: "DELIVERECT_PLU_MISSING" };
  }
  return { ok: true };
}

export function deliverectModifierOptionsMissingKitchenPlu(
  options: Array<{ deliverectModifierPlu?: string | null }>
): boolean {
  return options.some((o) => !o.deliverectModifierPlu?.trim());
}

export function validateDeliverectModifierKitchenMapping(input: {
  vendor: Pick<VendorMenuSourceFields, "menuSource">;
  options: Array<{ deliverectModifierPlu?: string | null }>;
}): { ok: true } | { ok: false; code: "DELIVERECT_MODIFIER_PLU_MISSING" } {
  if (!vendorRequiresDeliverectKitchenMapping(input.vendor)) {
    return { ok: true };
  }
  if (input.options.length === 0) {
    return { ok: true };
  }
  if (deliverectModifierOptionsMissingKitchenPlu(input.options)) {
    return { ok: false, code: "DELIVERECT_MODIFIER_PLU_MISSING" };
  }
  return { ok: true };
}

export function vendorUsesDeliverectSubItemsNestingRules(
  vendor: Pick<VendorMenuSourceFields, "menuSource">
): boolean {
  return isDeliverectMenuSource(vendor);
}
