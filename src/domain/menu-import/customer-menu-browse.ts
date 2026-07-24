/**
 * Which canonical products may appear as **top-level** tiles on the customer browsing menu.
 *
 * Canonical menus list many `products` entries: sellable parents, variant leaves, and modifier-option
 * rows. The normalizer keeps all of them as {@link OpenOrderCanonicalProduct} for publish + cart/modifier
 * resolution, but only a subset should be browsable as standalone items.
 *
 * Excluded from top-level browse:
 * 1. **Variant leaves** — `deliverectVariantParentPlu` set (selection happens inside the parent item).
 *    This is Deliverect leaf semantics; Square flattened variations must leave that field null and
 *    store the parent catalog ITEM id on `sourceParentExternalId` instead.
 * 2. **Modifier-only SKUs** — product id appears as a modifier `option.deliverectId` but is **not**
 *    listed in any category’s `productDeliverectIds` (these otherwise fall into “Other” / uncategorized).
 *
 * Still shown when the merchant explicitly placed the product in a category (legitimate standalone).
 */
import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { isVariantLeafProduct, variantParentPlu } from "@/domain/menu-import/canonical-identity";

export type CustomerMenuBrowseExclusionReason =
  | "variant_leaf"
  | "modifier_only_uncategorized";

export type CustomerMenuBrowseExclusion = {
  /** Legacy name kept for API compatibility; value is the product external/catalog id. */
  productDeliverectId: string;
  productName: string;
  reason: CustomerMenuBrowseExclusionReason;
  /** Safe, non-secret explanation for import review / publish diagnostics. */
  detail: string;
};

export function computeCustomerMenuBrowseExcludedProductIds(menu: OpenOrderCanonicalMenu): Set<string> {
  return new Set(explainCustomerMenuBrowseExclusions(menu).map((e) => e.productDeliverectId));
}

/**
 * Temporary safe diagnostics: why draft products would be hidden from the customer storefront
 * after publish (same rules as live browse). Does not include tokens or connection secrets.
 */
export function explainCustomerMenuBrowseExclusions(
  menu: OpenOrderCanonicalMenu
): CustomerMenuBrowseExclusion[] {
  const inAnyCategory = new Set<string>();
  for (const c of menu.categories) {
    for (const pid of c.productDeliverectIds) inAnyCategory.add(pid);
  }

  const optionDeliverectIds = new Set<string>();
  for (const g of menu.modifierGroupDefinitions) {
    for (const o of g.options) optionDeliverectIds.add(o.deliverectId);
  }

  const exclusions: CustomerMenuBrowseExclusion[] = [];
  for (const p of menu.products) {
    if (isVariantLeafProduct(p)) {
      exclusions.push({
        productDeliverectId: p.deliverectId,
        productName: p.name,
        reason: "variant_leaf",
        detail: `Marked as a variation leaf (parent PLU present); hidden from top-level browse. Parent linkage: ${variantParentPlu(p)}.`,
      });
      continue;
    }
    if (optionDeliverectIds.has(p.deliverectId) && !inAnyCategory.has(p.deliverectId)) {
      exclusions.push({
        productDeliverectId: p.deliverectId,
        productName: p.name,
        reason: "modifier_only_uncategorized",
        detail:
          "Appears only as a modifier option and is not listed in any category; hidden from top-level browse.",
      });
    }
  }
  return exclusions;
}
