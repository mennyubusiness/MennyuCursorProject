import { describe, expect, it } from "vitest";
import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import {
  isVariantLeafProduct,
  productExternalId,
  productSourceParentExternalId,
  resolveMenuSourceProvider,
} from "@/domain/menu-import/canonical-identity";
import { computeCustomerMenuBrowseExcludedProductIds } from "@/domain/menu-import/customer-menu-browse";
import { diagnoseMenuProviderConsistency } from "@/domain/menu-import/menu-provider-consistency";
import { menuSourceProvider } from "@/domain/menu-import/menu-source-provider";
import { squareProductInternalId } from "@/lib/integrations/square/square-menu-ids";

function baseProduct(overrides: Partial<OpenOrderCanonicalMenu["products"][number]> & { deliverectId: string; name: string }) {
  return {
    priceCents: 1000,
    isAvailable: true,
    sortOrder: 0,
    modifierGroupDeliverectIds: [],
    ...overrides,
  };
}

describe("canonical-identity + menu-source-provider", () => {
  it("derives sourceProvider from sourcePayloadKind", () => {
    expect(menuSourceProvider("square_catalog_v1")).toBe("square");
    expect(menuSourceProvider("open_order_builder_v1")).toBe("open_order");
    expect(menuSourceProvider("deliverect_menu_api_v1")).toBe("deliverect");
  });

  it("treats Deliverect leaf PLU as variant leaf, not Square parent id", () => {
    expect(isVariantLeafProduct({ deliverectVariantParentPlu: "PARENT" })).toBe(true);
    expect(isVariantLeafProduct({ deliverectVariantParentPlu: null })).toBe(false);
    expect(
      productSourceParentExternalId({ sourceParentExternalId: "item_1" })
    ).toBe("item_1");
    expect(
      isVariantLeafProduct({
        deliverectVariantParentPlu: null,
      })
    ).toBe(false);
  });
});

describe("diagnoseMenuProviderConsistency", () => {
  it("flags Square products that misuse deliverectVariantParentPlu", () => {
    const menu: OpenOrderCanonicalMenu = {
      schemaVersion: 1,
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "square_catalog_v1", locationId: "LOC" },
      categories: [
        {
          deliverectId: "sq:cat:1",
          name: "Bowls",
          sortOrder: 0,
          productDeliverectIds: [squareProductInternalId("var_1")],
        },
      ],
      modifierGroupDefinitions: [],
      products: [
        baseProduct({
          deliverectId: squareProductInternalId("var_1"),
          name: "Bowl — Regular",
          deliverectVariantParentPlu: "ITEM_PARENT",
          sourceParentExternalId: "ITEM_PARENT",
        }),
      ],
    };

    const issues = diagnoseMenuProviderConsistency(menu);
    expect(issues.some((i) => i.code === "square_uses_deliverect_variant_leaf_field")).toBe(true);
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).has(squareProductInternalId("var_1"))).toBe(
      true
    );
  });

  it("allows Square multi-variation items with sourceParentExternalId only", () => {
    const menu: OpenOrderCanonicalMenu = {
      schemaVersion: 1,
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "square_catalog_v1", locationId: "LOC" },
      categories: [
        {
          deliverectId: "sq:cat:1",
          name: "Bowls",
          sortOrder: 0,
          productDeliverectIds: [
            squareProductInternalId("var_reg"),
            squareProductInternalId("var_lg"),
          ],
        },
      ],
      modifierGroupDefinitions: [],
      products: [
        baseProduct({
          deliverectId: squareProductInternalId("var_reg"),
          name: "Bowl — Regular",
          deliverectVariantParentPlu: null,
          sourceParentExternalId: "ITEM_1",
        }),
        baseProduct({
          deliverectId: squareProductInternalId("var_lg"),
          name: "Bowl — Large",
          deliverectVariantParentPlu: null,
          sourceParentExternalId: "ITEM_1",
          sortOrder: 1,
        }),
      ],
    };

    expect(diagnoseMenuProviderConsistency(menu)).toEqual([]);
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).size).toBe(0);
    expect(resolveMenuSourceProvider(menu)).toBe("square");
    expect(productExternalId(menu.products[0]!)).toBe(squareProductInternalId("var_reg"));
  });

  it("does not flag Deliverect variant leaves (intended browse hide)", () => {
    const menu: OpenOrderCanonicalMenu = {
      schemaVersion: 1,
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
      categories: [
        {
          deliverectId: "cat",
          name: "Mains",
          sortOrder: 0,
          productDeliverectIds: ["parent"],
        },
      ],
      modifierGroupDefinitions: [],
      products: [
        baseProduct({ deliverectId: "parent", name: "Burger" }),
        baseProduct({
          deliverectId: "leaf",
          name: "Large",
          deliverectVariantParentPlu: "BURGER-PLU",
          sortOrder: 1,
        }),
      ],
    };

    const issues = diagnoseMenuProviderConsistency(menu);
    expect(issues.some((i) => i.code === "square_uses_deliverect_variant_leaf_field")).toBe(false);
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).has("leaf")).toBe(true);
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).has("parent")).toBe(false);
  });

  it("manual open_order menus do not require external mapping fields for browse", () => {
    const menu: OpenOrderCanonicalMenu = {
      schemaVersion: 1,
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "open_order_builder_v1" },
      categories: [
        {
          deliverectId: "oo:cat:1",
          name: "Drinks",
          sortOrder: 0,
          productDeliverectIds: ["oo:prod:1"],
        },
      ],
      modifierGroupDefinitions: [],
      products: [
        baseProduct({
          deliverectId: "oo:prod:1",
          name: "Tea",
          deliverectVariantParentPlu: null,
          sourceParentExternalId: null,
        }),
      ],
    };

    expect(diagnoseMenuProviderConsistency(menu)).toEqual([]);
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).size).toBe(0);
  });
});
