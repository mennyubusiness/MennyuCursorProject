/**
 * Deliverect **nested `subItems` depth** for channel orders (API hard limit, historically MAX 3).
 *
 * This is **not** a cap on modifiers, toppings, or “choices” in general. It limits how many
 * **top-level** `deliverectIsVariantGroup` selections we can serialize as a vertical `subItems`
 * chain (see `nestVariantGroupSelections` in `transform.ts`). Groups under another modifier option
 * (`ModifierGroup.parentModifierOptionId`) use `modifiers` / `nestedModifiers` instead and do **not**
 * consume this budget.
 *
 * When `MenuItem.deliverectVariantParentPlu` is set, the parent PLU row adds one extra wrapper level,
 * so fewer chain steps fit before hitting the API max.
 */

/** Maximum nesting depth of Deliverect `subItems` nodes on a line item (Deliverect API limit). */
export const DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH = 3;

/** @deprecated Use {@link DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH}. */
export const DELIVERECT_MAX_SUBITEM_NESTING = DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH;

/**
 * True when this modifier group is a **root** Deliverect “variant group” row: flagged
 * `deliverectIsVariantGroup` and not nested under another option. Those groups participate in the
 * outbound `subItems` chain (not the general modifier list).
 */
export function isTopLevelDeliverectVariantGroupModifierGroup(group: {
  deliverectIsVariantGroup: boolean | null;
  parentModifierOptionId: string | null;
}): boolean {
  return group.deliverectIsVariantGroup === true && group.parentModifierOptionId == null;
}

/**
 * How many **selected** top-level variant-group options sit on this line — each becomes one level in
 * `nestVariantGroupSelections` (same basis as `transform.ts` and cart checks).
 */
export function countSubItemsChainVariantSelections(line: {
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

export function deliverectSubItemsChainDepth(args: {
  /** True when the menu row uses parent PLU + leaf (adds one wrapper `subItems` level). */
  hasDeliverectVariantParentPlu: boolean;
  /** From {@link countSubItemsChainVariantSelections}. */
  chainVariantStepCount: number;
}): number {
  const { hasDeliverectVariantParentPlu, chainVariantStepCount } = args;
  return hasDeliverectVariantParentPlu ? 1 + chainVariantStepCount : chainVariantStepCount;
}

export function isDeliverectSubItemsChainDepthAllowed(args: {
  hasDeliverectVariantParentPlu: boolean;
  chainVariantStepCount: number;
}): boolean {
  return deliverectSubItemsChainDepth(args) <= DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH;
}

/**
 * Max **chain steps** allowed for this product shape before exceeding {@link DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH}.
 * Variant parent + leaf uses one level for the wrapper line, so one fewer variant-group step fits.
 */
export function maxSubItemsChainVariantStepsForProductShape(hasDeliverectVariantParentPlu: boolean): number {
  return hasDeliverectVariantParentPlu
    ? Math.max(0, DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH - 1)
    : DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH;
}

/** @deprecated Use {@link maxSubItemsChainVariantStepsForProductShape}. */
export const maxDeliverectVariantGroupSelectionsForMenuItem = maxSubItemsChainVariantStepsForProductShape;

/** Cart / checkout / routing — customer-readable; explains Deliverect + what counts. */
export function deliverectSubItemsChainLimitMessage(itemName: string, maxChainSteps: number): string {
  const stepWord = maxChainSteps === 1 ? "level" : "levels";
  return (
    `“${itemName}” can’t be sent to the restaurant’s system: Deliverect allows at most ${maxChainSteps} nested menu ${stepWord} in the online order for this product (size/style “variant” groups on the main item only — not toppings or add-ons nested under another choice). ` +
    `Remove one of those steps, or ask the restaurant to turn off “variant group” on groups that should be normal modifiers.`
  );
}

/** @deprecated Use {@link deliverectSubItemsChainLimitMessage}. */
export function deliverectSubItemNestingCartSummaryMessage(itemName: string, max: number): string {
  return deliverectSubItemsChainLimitMessage(itemName, max);
}

/** @deprecated Use {@link deliverectSubItemsChainLimitMessage}. */
export function deliverectSubItemNestingBlockedMessage(itemName: string): string {
  return deliverectSubItemsChainLimitMessage(itemName, DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH);
}

/** @deprecated Use {@link deliverectSubItemsChainDepth}. */
export function deliverectSubItemDepthFromLine(args: {
  hasDeliverectVariantParentPlu: boolean;
  variantGroupSelectionCount: number;
}): number {
  return deliverectSubItemsChainDepth({
    hasDeliverectVariantParentPlu: args.hasDeliverectVariantParentPlu,
    chainVariantStepCount: args.variantGroupSelectionCount,
  });
}

/** @deprecated Use {@link isDeliverectSubItemsChainDepthAllowed}. */
export function isDeliverectSubItemDepthAllowed(args: {
  hasDeliverectVariantParentPlu: boolean;
  variantGroupSelectionCount: number;
}): boolean {
  return isDeliverectSubItemsChainDepthAllowed({
    hasDeliverectVariantParentPlu: args.hasDeliverectVariantParentPlu,
    chainVariantStepCount: args.variantGroupSelectionCount,
  });
}

/** @deprecated Use {@link countSubItemsChainVariantSelections}. */
export const countTopLevelDeliverectVariantGroupSelections = countSubItemsChainVariantSelections;
