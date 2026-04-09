import { describe, expect, it } from "vitest";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { computeCustomerMenuBrowseExcludedProductIds } from "./customer-menu-browse";

function minimalMenu(overrides: Partial<MennyuCanonicalMenu> & Pick<MennyuCanonicalMenu, "products">): MennyuCanonicalMenu {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    categories: [],
    modifierGroupDefinitions: [],
    ...overrides,
  };
}

describe("computeCustomerMenuBrowseExcludedProductIds", () => {
  it("excludes variant leaf products (deliverectVariantParentPlu)", () => {
    const menu = minimalMenu({
      products: [
        {
          deliverectId: "parent",
          name: "Burger",
          priceCents: 800,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
        {
          deliverectId: "leaf",
          name: "Large",
          deliverectVariantParentPlu: "BURGER-PLU",
          deliverectVariantParentName: "Burger",
          priceCents: 0,
          isAvailable: true,
          sortOrder: 1,
          modifierGroupDeliverectIds: [],
        },
      ],
    });
    const ex = computeCustomerMenuBrowseExcludedProductIds(menu);
    expect(ex.has("leaf")).toBe(true);
    expect(ex.has("parent")).toBe(false);
  });

  it("excludes modifier-only products not in any category (appear under modifier groups only)", () => {
    const menu = minimalMenu({
      categories: [
        {
          deliverectId: "cat1",
          name: "Mains",
          sortOrder: 0,
          productDeliverectIds: ["parent"],
        },
      ],
      modifierGroupDefinitions: [
        {
          deliverectId: "mg1",
          name: "Cheese",
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          sortOrder: 0,
          parentDeliverectOptionId: null,
          options: [
            {
              deliverectId: "mod-cheese",
              name: "Extra cheese",
              priceCents: 100,
              sortOrder: 0,
              isDefault: false,
              isAvailable: true,
              nestedGroupDeliverectIds: [],
            },
          ],
        },
      ],
      products: [
        {
          deliverectId: "parent",
          name: "Burger",
          priceCents: 800,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: ["mg1"],
        },
        {
          deliverectId: "mod-cheese",
          name: "Extra cheese",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 1,
          modifierGroupDeliverectIds: [],
        },
      ],
    });
    const ex = computeCustomerMenuBrowseExcludedProductIds(menu);
    expect(ex.has("mod-cheese")).toBe(true);
    expect(ex.has("parent")).toBe(false);
  });

  it("does not exclude a product that is both a modifier option and explicitly categorized", () => {
    const menu = minimalMenu({
      categories: [
        {
          deliverectId: "cat1",
          name: "Sides",
          sortOrder: 0,
          productDeliverectIds: ["fries"],
        },
      ],
      modifierGroupDefinitions: [
        {
          deliverectId: "mg1",
          name: "Size",
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          sortOrder: 0,
          parentDeliverectOptionId: null,
          options: [
            {
              deliverectId: "fries",
              name: "Fries",
              priceCents: 400,
              sortOrder: 0,
              isDefault: true,
              isAvailable: true,
              nestedGroupDeliverectIds: [],
            },
          ],
        },
      ],
      products: [
        {
          deliverectId: "fries",
          name: "Fries",
          priceCents: 400,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
      ],
    });
    const ex = computeCustomerMenuBrowseExcludedProductIds(menu);
    expect(ex.has("fries")).toBe(false);
  });
});
