/**
 * Attach per-product Open Order group kinds to a canonical menu after normalization.
 */
import type { MennyuCanonicalMenu, MennyuCanonicalProduct } from "@/domain/menu-import/canonical.schema";
import {
  classifyOpenOrderModifierGroup,
  classificationInputFromCanonicalGroup,
  type OpenOrderModifierGroupKind,
} from "@/domain/modifier-group-kind";

import { variantChildCountByParentPluFromProducts } from "@/lib/deliverect-variant-child-count";

export function buildVariantChildCountByParentPlu(products: MennyuCanonicalProduct[]): Map<string, number> {
  return variantChildCountByParentPluFromProducts(products);
}

export function classifyProductModifierGroupKind(
  menu: MennyuCanonicalMenu,
  product: MennyuCanonicalProduct,
  groupDeliverectId: string,
  variantChildCounts: Map<string, number>
): OpenOrderModifierGroupKind | null {
  const gdef = menu.modifierGroupDefinitions.find((g) => g.deliverectId === groupDeliverectId);
  if (!gdef) return null;
  const parentPlu = product.plu?.trim() ?? product.deliverectId;
  const variantChildMenuItemCount = variantChildCounts.get(parentPlu) ?? 0;
  return classifyOpenOrderModifierGroup(
    classificationInputFromCanonicalGroup(gdef, variantChildMenuItemCount, {
      isNested: gdef.parentDeliverectOptionId != null,
    })
  ).kind;
}

export function attachModifierGroupKindsToCanonicalMenu(menu: MennyuCanonicalMenu): MennyuCanonicalMenu {
  const variantChildCounts = buildVariantChildCountByParentPlu(menu.products);
  const products = menu.products.map((product) => {
    const kinds: Record<string, OpenOrderModifierGroupKind> = {};
    for (const gid of product.modifierGroupDeliverectIds) {
      const kind = classifyProductModifierGroupKind(menu, product, gid, variantChildCounts);
      if (kind) kinds[gid] = kind;
    }
    return {
      ...product,
      modifierGroupKinds: Object.keys(kinds).length > 0 ? kinds : undefined,
    };
  });
  return { ...menu, products };
}
