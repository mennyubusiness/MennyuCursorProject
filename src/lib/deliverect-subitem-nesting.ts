/**
 * Deliverect channel order API rejects payloads when `subItems` nesting exceeds this depth
 * (Pydantic: "Maximum allowed level of subitems nesting reached. MAX.: 3").
 *
 * Our transform nests each **top-level** `deliverectIsVariantGroup` selection as one `subItems`
 * level in {@link nestVariantGroupSelections}. Variant products also wrap the variation line as an
 * extra level under the parent PLU.
 *
 * Modifier groups nested under another option (`ModifierGroup.parentModifierOptionId`) are serialized
 * under `modifiers` / `nestedModifiers`, not as extra root `subItems` levels — they must **not**
 * count toward this limit (mis-counting caused false blocks when many add-on groups were flagged).
 */

export const DELIVERECT_MAX_SUBITEM_NESTING = 3;

/** True when this group is a Deliverect variant step on the main product (contributes to `subItems` chain depth). */
export function isTopLevelDeliverectVariantGroupModifierGroup(group: {
  deliverectIsVariantGroup: boolean | null;
  parentModifierOptionId: string | null;
}): boolean {
  return group.deliverectIsVariantGroup === true && group.parentModifierOptionId == null;
}

/** Selections that form the nested `subItems` chain on the order line (same basis as `transform.ts`). */
export function countTopLevelDeliverectVariantGroupSelections(line: {
  selections: Array<{
    modifierOption: {
      modifierGroup: { deliverectIsVariantGroup: boolean | null; parentModifierOptionId: string | null };
    };
  }>;
}): number {
  return line.selections.filter((s) =>
    isTopLevelDeliverectVariantGroupModifierGroup(s.modifierOption.modifierGroup)
  ).length;
}

export function deliverectSubItemDepthFromLine(args: {
  hasDeliverectVariantParentPlu: boolean;
  variantGroupSelectionCount: number;
}): number {
  const { hasDeliverectVariantParentPlu, variantGroupSelectionCount } = args;
  return hasDeliverectVariantParentPlu
    ? 1 + variantGroupSelectionCount
    : variantGroupSelectionCount;
}

export function isDeliverectSubItemDepthAllowed(args: {
  hasDeliverectVariantParentPlu: boolean;
  variantGroupSelectionCount: number;
}): boolean {
  return deliverectSubItemDepthFromLine(args) <= DELIVERECT_MAX_SUBITEM_NESTING;
}

/**
 * Max number of `deliverectIsVariantGroup` selections allowed for this product shape.
 * Variant parent + leaf uses one nesting level for the leaf line, so fewer variant-group steps fit.
 */
export function maxDeliverectVariantGroupSelectionsForMenuItem(
  hasDeliverectVariantParentPlu: boolean
): number {
  return hasDeliverectVariantParentPlu
    ? Math.max(0, DELIVERECT_MAX_SUBITEM_NESTING - 1)
    : DELIVERECT_MAX_SUBITEM_NESTING;
}

/** Cart / checkout / validation — short, non-technical. */
export function deliverectSubItemNestingCartSummaryMessage(itemName: string, max: number): string {
  const stepLabel = max === 1 ? "step" : "steps";
  return `“${itemName}” exceeds the ${max} nested size/variation ${stepLabel} allowed for online orders (Deliverect limit). This counts only top-level variant groups (e.g. size), not nested add-ons. Remove a variation choice or ask the restaurant to fix variant-group flags on the menu.`;
}

/** @deprecated Prefer {@link deliverectSubItemNestingCartSummaryMessage} with a computed max. */
export function deliverectSubItemNestingBlockedMessage(itemName: string): string {
  return deliverectSubItemNestingCartSummaryMessage(itemName, DELIVERECT_MAX_SUBITEM_NESTING);
}
