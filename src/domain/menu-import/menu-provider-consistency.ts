/**
 * Safe, non-secret diagnostics for provider/metadata consistency on canonical menus.
 * Never logs tokens or connection credentials.
 */
import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import {
  isVariantLeafProduct,
  productExternalId,
  productSourceParentExternalId,
  resolveMenuSourceProvider,
} from "@/domain/menu-import/canonical-identity";
import { computeCustomerMenuBrowseExcludedProductIds } from "@/domain/menu-import/customer-menu-browse";
import { isSquareProductDeliverectId } from "@/lib/integrations/square/square-menu-ids";

export type MenuProviderConsistencyCode =
  | "square_uses_deliverect_variant_leaf_field"
  | "square_id_expected_but_missing_prefix"
  | "open_order_uses_deliverect_variant_leaf_field"
  | "published_item_hidden_by_variant_leaf_metadata"
  | "source_parent_with_variant_leaf_field";

export type MenuProviderConsistencyIssue = {
  code: MenuProviderConsistencyCode;
  severity: "warning" | "error";
  productExternalId: string;
  productName: string;
  message: string;
};

export function diagnoseMenuProviderConsistency(menu: OpenOrderCanonicalMenu): MenuProviderConsistencyIssue[] {
  const provider = resolveMenuSourceProvider(menu);
  const issues: MenuProviderConsistencyIssue[] = [];
  const browseExcluded = computeCustomerMenuBrowseExcludedProductIds(menu);

  for (const p of menu.products) {
    const extId = productExternalId(p);
    const isLeaf = isVariantLeafProduct(p);
    const parentExt = productSourceParentExternalId(p);

    if (provider === "square" && isLeaf) {
      issues.push({
        code: "square_uses_deliverect_variant_leaf_field",
        severity: "error",
        productExternalId: extId,
        productName: p.name,
        message:
          "Square product has deliverectVariantParentPlu set. That field marks Deliverect variant leaves and hides the item from customer browse. Use sourceParentExternalId for the Square ITEM id instead.",
      });
    }

    if (provider === "square" && !isSquareProductDeliverectId(extId)) {
      issues.push({
        code: "square_id_expected_but_missing_prefix",
        severity: "warning",
        productExternalId: extId,
        productName: p.name,
        message: "Square catalog menu product id does not use the sq:prod: prefix.",
      });
    }

    if (provider === "open_order" && isLeaf) {
      issues.push({
        code: "open_order_uses_deliverect_variant_leaf_field",
        severity: "warning",
        productExternalId: extId,
        productName: p.name,
        message:
          "Manual Open Order product is marked as a variant leaf. Manual menus normally should not set deliverectVariantParentPlu.",
      });
    }

    if (parentExt && isLeaf) {
      issues.push({
        code: "source_parent_with_variant_leaf_field",
        severity: "warning",
        productExternalId: extId,
        productName: p.name,
        message:
          "Product has both sourceParentExternalId and deliverectVariantParentPlu. Parent external id is for mapping; variant leaf PLU controls browse/nesting — do not overload both for the same concern.",
      });
    }

    if (isLeaf && browseExcluded.has(extId) && (provider === "square" || provider === "open_order")) {
      issues.push({
        code: "published_item_hidden_by_variant_leaf_metadata",
        severity: "error",
        productExternalId: extId,
        productName: p.name,
        message:
          "Item would be hidden on the customer menu because variant-leaf metadata is set. Confirm this is intentional Deliverect leaf behavior, not provider parent-id reuse.",
      });
    }
  }

  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}:${i.productExternalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
