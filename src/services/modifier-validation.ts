/**
 * Deliverect-compliant modifier validation for cart and order.
 * Enforces min/max selections, required groups, snooze/availability, and basket limits.
 */
import { prisma } from "@/lib/db";

export type ModifierValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string; cartItemId?: string; menuItemId?: string; menuItemName?: string };

type CartItemForValidation = {
  id: string;
  menuItemId: string;
  quantity: number;
  menuItem?: { name: string; isAvailable: boolean; basketMaxQuantity?: number | null };
  selections?: Array<{ modifierOptionId: string; quantity: number }>;
};

/**
 * Validate a single cart item's modifier selections against the item's modifier group rules.
 * Enforces: required groups, min/max per group, quantity >= 1 per selection, nested group rules, snooze (isAvailable).
 */
export async function validateCartItemModifiers(cartItem: CartItemForValidation): Promise<ModifierValidationResult> {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: cartItem.menuItemId },
    include: {
      modifierGroups: {
        include: {
          modifierGroup: {
            include: {
              options: {
                include: {
                  nestedModifierGroups: {
                    include: { options: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!menuItem) {
    return { valid: false, code: "ITEM_NOT_FOUND", message: "Menu item not found.", menuItemId: cartItem.menuItemId, menuItemName: cartItem.menuItem?.name };
  }

  if (!menuItem.isAvailable) {
    return { valid: false, code: "ITEM_UNAVAILABLE", message: `${menuItem.name} is no longer available.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
  }

  const selections = cartItem.selections ?? [];
  const selectionByOptionId = new Map(selections.map((s) => [s.modifierOptionId, s.quantity]));

  const hasAnyModifierGroups = menuItem.modifierGroups.length > 0;
  if (!hasAnyModifierGroups && selections.length > 0) {
    return { valid: false, code: "INVALID_MODIFIER_OPTION", message: `${menuItem.name} does not have modifiers.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
  }
  if (!hasAnyModifierGroups) return { valid: true };

  for (const qty of selectionByOptionId.values()) {
    if (qty < 1) {
      return { valid: false, code: "INVALID_MODIFIER_QUANTITY", message: "Modifier quantity must be at least 1.", cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
    }
  }

  const optionIdsSelected = new Set(selectionByOptionId.keys());

  for (const link of menuItem.modifierGroups) {
    const group = link.modifierGroup;
    if (group.parentModifierOptionId != null) continue;

    if (!group.isAvailable && (link.required || link.minSelections > 0)) {
      return { valid: false, code: "MODIFIER_GROUP_UNAVAILABLE", message: `"${group.name}" for ${menuItem.name} is currently unavailable.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
    }

    const groupOptionIds = new Set(group.options.map((o) => o.id));
    let totalQty = 0;
    for (const opt of group.options) {
      const qty = selectionByOptionId.get(opt.id) ?? 0;
      if (qty > 0) {
        if (!opt.isAvailable) {
          return { valid: false, code: "MODIFIER_OPTION_UNAVAILABLE", message: `"${opt.name}" for ${menuItem.name} is currently unavailable.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
        }
        totalQty += qty;
      }
    }

    if (totalQty < link.minSelections) {
      return { valid: false, code: "MODIFIER_MIN_SELECTIONS", message: `"${group.name}" for ${menuItem.name} requires at least ${link.minSelections} selection(s).`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
    }
    if (totalQty > link.maxSelections) {
      return { valid: false, code: "MODIFIER_MAX_SELECTIONS", message: `"${group.name}" for ${menuItem.name} allows at most ${link.maxSelections} selection(s).`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
    }
  }

  for (const link of menuItem.modifierGroups) {
    const group = link.modifierGroup;
    for (const option of group.options) {
      const qty = selectionByOptionId.get(option.id) ?? 0;
      if (qty < 1) continue;
      for (const nestedGroup of option.nestedModifierGroups) {
        if (!nestedGroup.isAvailable && nestedGroup.minSelections > 0) {
          return { valid: false, code: "MODIFIER_GROUP_UNAVAILABLE", message: `"${nestedGroup.name}" for ${menuItem.name} is currently unavailable.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
        }
        const nestedOptionIds = new Set(nestedGroup.options.map((o) => o.id));
        let nestedTotal = 0;
        for (const no of nestedGroup.options) {
          const nq = selectionByOptionId.get(no.id) ?? 0;
          if (nq > 0) {
            if (!no.isAvailable) {
              return { valid: false, code: "MODIFIER_OPTION_UNAVAILABLE", message: `"${no.name}" for ${menuItem.name} is currently unavailable.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
            }
            nestedTotal += nq;
          }
        }
        if (nestedTotal < nestedGroup.minSelections) {
          return { valid: false, code: "MODIFIER_MIN_SELECTIONS", message: `"${nestedGroup.name}" for ${menuItem.name} requires at least ${nestedGroup.minSelections} selection(s).`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
        }
        if (nestedTotal > nestedGroup.maxSelections) {
          return { valid: false, code: "MODIFIER_MAX_SELECTIONS", message: `"${nestedGroup.name}" for ${menuItem.name} allows at most ${nestedGroup.maxSelections} selection(s).`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
        }
      }
    }
  }

  const allOptionIds = new Set<string>();
  for (const link of menuItem.modifierGroups) {
    for (const opt of link.modifierGroup.options) {
      allOptionIds.add(opt.id);
      for (const ng of opt.nestedModifierGroups) {
        for (const no of ng.options) allOptionIds.add(no.id);
      }
    }
  }
  for (const optionId of optionIdsSelected) {
    if (!allOptionIds.has(optionId)) {
      return { valid: false, code: "INVALID_MODIFIER_OPTION", message: `A selected modifier for ${menuItem.name} does not belong to this item.`, cartItemId: cartItem.id, menuItemId: cartItem.menuItemId, menuItemName: menuItem.name };
    }
  }

  return { valid: true };
}

/**
 * Validate basket (multimax) limits: total quantity per menu item across the cart must not exceed MenuItem.basketMaxQuantity when set.
 */
export async function validateCartBasketLimits(items: Array<{ menuItemId: string; quantity: number }>): Promise<ModifierValidationResult> {
  const byMenuItem = new Map<string, number>();
  for (const item of items) {
    byMenuItem.set(item.menuItemId, (byMenuItem.get(item.menuItemId) ?? 0) + item.quantity);
  }
  for (const [menuItemId, totalQty] of byMenuItem) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { name: true, basketMaxQuantity: true },
    });
    if (!menuItem?.basketMaxQuantity) continue;
    if (totalQty > menuItem.basketMaxQuantity) {
      return { valid: false, code: "BASKET_LIMIT_EXCEEDED", message: `${menuItem.name} has a maximum of ${menuItem.basketMaxQuantity} per order.`, menuItemId };
    }
  }
  return { valid: true };
}
