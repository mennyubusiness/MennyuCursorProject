/**
 * Deliverect channel order API rejects payloads when `subItems` nesting exceeds this depth
 * (Pydantic: "Maximum allowed level of subitems nesting reached. MAX.: 3").
 *
 * Our transform nests each `deliverectIsVariantGroup` selection as one `subItems` level; variant
 * products also wrap the variation line as an extra level under the parent PLU.
 */

export const DELIVERECT_MAX_SUBITEM_NESTING = 3;

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

/** Customer-facing copy when cart or submission is blocked by this limit. */
export function deliverectSubItemNestingBlockedMessage(itemName: string): string {
  return `${itemName} has too many nested “variant group” modifiers for the kitchen integration (Deliverect allows at most ${DELIVERECT_MAX_SUBITEM_NESTING} levels). Remove some options or ask the restaurant to configure extra toppings as regular modifiers instead of variant groups.`;
}
