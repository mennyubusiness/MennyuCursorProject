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
  return `“${itemName}” allows at most ${max} variation ${max === 1 ? "step" : "steps"} for online orders. Remove a few choices and try again.`;
}

/** Add-to-cart / save modifier line — matches server {@link assertDeliverectVariantGroupNestingAllowed}. */
export function customerFacingDeliverectVariantLimitExceeded(itemName: string, max: number): string {
  const n = max === 1 ? "choice" : "choices";
  return `Too many variation ${n} for “${itemName}”. Online orders allow at most ${max} across all size/style variation groups combined. Remove a variation and try again.`;
}

/** @deprecated Prefer {@link deliverectSubItemNestingCartSummaryMessage} with a computed max. */
export function deliverectSubItemNestingBlockedMessage(itemName: string): string {
  return deliverectSubItemNestingCartSummaryMessage(itemName, DELIVERECT_MAX_SUBITEM_NESTING);
}
