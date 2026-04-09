/**
 * Which canonical products may appear as **top-level** tiles on the customer browsing menu.
 *
 * Deliverect menus list many `products` entries: sellable parents, variant leaves, and modifier-option
 * rows. The normalizer keeps all of them as {@link MennyuCanonicalProduct} for publish + cart/modifier
 * resolution, but only a subset should be browsable as standalone items.
 *
 * Excluded from top-level browse:
 * 1. **Variant leaves** — `deliverectVariantParentPlu` set (selection happens inside the parent item).
 * 2. **Modifier-only SKUs** — product id appears as a modifier `option.deliverectId` but is **not**
 *    listed in any category’s `productDeliverectIds` (these otherwise fall into “Other” / uncategorized).
 *
 * Still shown when the merchant explicitly placed the product in a category (legitimate standalone).
 */
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";

export function computeCustomerMenuBrowseExcludedProductIds(menu: MennyuCanonicalMenu): Set<string> {
  const inAnyCategory = new Set<string>();
  for (const c of menu.categories) {
    for (const pid of c.productDeliverectIds) inAnyCategory.add(pid);
  }

  const optionDeliverectIds = new Set<string>();
  for (const g of menu.modifierGroupDefinitions) {
    for (const o of g.options) optionDeliverectIds.add(o.deliverectId);
  }

  const excluded = new Set<string>();
  for (const p of menu.products) {
    if (p.deliverectVariantParentPlu?.trim()) {
      excluded.add(p.deliverectId);
      continue;
    }
    if (optionDeliverectIds.has(p.deliverectId) && !inAnyCategory.has(p.deliverectId)) {
      excluded.add(p.deliverectId);
    }
  }
  return excluded;
}
