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
 * Line shape shared by cart checks, {@link validateDeliverectSubItemsChainDepth}, and
 * {@link partitionTopLevelVariantSelectionsForDeliverectChain} / `transform.ts`.
 */
export type LineSelectionsForDeliverectVariantChain = {
  selections: Array<{
    modifierOption: {
      modifierGroup: {
        id: string;
        sortOrder: number;
        name?: string;
        deliverectIsVariantGroup: boolean | null;
        parentModifierOptionId: string | null;
      };
    };
  }>;
};

/** Compact JSON-safe detail when subItems chain validation fails (logs / support). */
export function deliverectSubitemsChainValidationDetail(
  line: LineSelectionsForDeliverectVariantChain & {
    menuItem?: { id?: string; name?: string | null };
  }
): {
  menuItemId?: string;
  menuItemName?: string | null;
  topLevelVariantGroups: Array<{
    modifierGroupId: string;
    modifierGroupName?: string;
    selectionCount: number;
    countsTowardSubItemsChain: boolean;
  }>;
  chainStepCount: number;
  demotedToFlatModifierSelectionCount: number;
} {
  const variantSels = line.selections.filter((s) =>
    isTopLevelDeliverectVariantGroupModifierGroup(s.modifierOption.modifierGroup)
  );
  const byGroup = new Map<
    string,
    { name?: string; selectionCount: number }
  >();
  for (const s of variantSels) {
    const g = s.modifierOption.modifierGroup;
    const cur = byGroup.get(g.id) ?? { name: g.name, selectionCount: 0 };
    cur.selectionCount += 1;
    byGroup.set(g.id, cur);
  }
  const { chainSelections, demotedToFlatModifierSelections } =
    partitionTopLevelVariantSelectionsForDeliverectChain(line);
  return {
    menuItemId: line.menuItem?.id,
    menuItemName: line.menuItem?.name ?? null,
    topLevelVariantGroups: [...byGroup.entries()].map(([modifierGroupId, v]) => ({
      modifierGroupId,
      modifierGroupName: v.name,
      selectionCount: v.selectionCount,
      countsTowardSubItemsChain: v.selectionCount === 1,
    })),
    chainStepCount: chainSelections.length,
    demotedToFlatModifierSelectionCount: demotedToFlatModifierSelections.length,
  };
}

/**
 * Top-level Deliverect “variant group” selections split for `subItems` nesting vs flat `modifiers`.
 *
 * Only **one** selection per modifier group may participate in the vertical `subItems` chain (e.g. Size →
 * Crust). If the customer picks **multiple** options from the **same** variant-flagged group (multi-max
 * “pick up to N”), those are **not** extra chain levels — they are sent as flat modifiers like normal
 * add-ons. Counting raw selections here was a false positive when max selection > 1.
 */
export function partitionTopLevelVariantSelectionsForDeliverectChain<
  S extends LineSelectionsForDeliverectVariantChain["selections"][number],
>(line: { selections: readonly S[] }): {
  /** One entry per distinct variant group that has exactly one selected option on this line (chain depth). */
  chainSelections: S[];
  /** Multi-select from the same variant-flagged group — serialize as `modifiers`, not nested `subItems`. */
  demotedToFlatModifierSelections: S[];
} {
  const variantSels = line.selections.filter((s) =>
    isTopLevelDeliverectVariantGroupModifierGroup(s.modifierOption.modifierGroup)
  );
  const byGroup = new Map<string, S[]>();
  for (const s of variantSels) {
    const gid = s.modifierOption.modifierGroup.id;
    const list = byGroup.get(gid) ?? [];
    list.push(s);
    byGroup.set(gid, list);
  }
  const chainSelections: S[] = [];
  const demotedToFlatModifierSelections: S[] = [];
  for (const list of byGroup.values()) {
    if (list.length === 1) {
      chainSelections.push(list[0]!);
    } else {
      demotedToFlatModifierSelections.push(...list);
    }
  }
  chainSelections.sort(
    (a, b) => a.modifierOption.modifierGroup.sortOrder - b.modifierOption.modifierGroup.sortOrder
  );
  return { chainSelections, demotedToFlatModifierSelections };
}

/**
 * How many **vertical** `subItems` steps we will emit for variant groups on this line (same basis as
 * `nestVariantGroupSelections` in `transform.ts`). Not the raw count of variant-flagged options when
 * multi-select is used within one group.
 */
export function countSubItemsChainVariantSelections(line: LineSelectionsForDeliverectVariantChain): number {
  return partitionTopLevelVariantSelectionsForDeliverectChain(line).chainSelections.length;
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
