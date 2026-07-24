import { describe, expect, it } from "vitest";
import { normalizeSquareCatalogToCanonical } from "@/lib/integrations/square/square-catalog-normalizer";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";
import {
  squareCategoryInternalId,
  squareModifierGroupInternalId,
  squareModifierOptionInternalId,
  squareProductInternalId,
} from "@/lib/integrations/square/square-menu-ids";

const LOCATION_ID = "LOC_MAIN";

function baseCatalog(): SquareCatalogObject[] {
  return [
    {
      type: "CATEGORY",
      id: "cat_drinks",
      present_at_all_locations: true,
      category_data: { name: "Drinks" },
    },
    {
      type: "ITEM",
      id: "item_latte",
      present_at_all_locations: true,
      item_data: {
        name: "Latte",
        description: "Espresso and milk",
        categories: [{ id: "cat_drinks" }],
        modifier_list_info: [{ modifier_list_id: "modlist_milk", enabled: true }],
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_latte_sm",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Small",
        item_id: "item_latte",
        price_money: { amount: 450, currency: "USD" },
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_latte_lg",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Large",
        item_id: "item_latte",
        price_money: { amount: 550, currency: "USD" },
      },
    },
    {
      type: "MODIFIER_LIST",
      id: "modlist_milk",
      present_at_all_locations: true,
      modifier_list_data: {
        name: "Milk",
        selection_type: "SINGLE",
        modifiers: [{ id: "mod_oat", type: "MODIFIER" }],
      },
    },
    {
      type: "MODIFIER",
      id: "mod_oat",
      present_at_all_locations: true,
      modifier_data: {
        name: "Oat milk",
        price_money: { amount: 50, currency: "USD" },
        modifier_list_id: "modlist_milk",
      },
    },
  ];
}

describe("normalizeSquareCatalogToCanonical", () => {
  it("maps categories, flattened variations, and modifiers", () => {
    const result = normalizeSquareCatalogToCanonical({
      vendorId: "vendor_1",
      locationId: LOCATION_ID,
      objects: baseCatalog(),
    });

    expect(result.menu).not.toBeNull();
    expect(result.stats.categories).toBe(1);
    expect(result.stats.items).toBe(2);
    expect(result.stats.modifierGroups).toBe(1);
    expect(result.stats.modifierOptions).toBe(1);

    const menu = result.menu!;
    expect(menu.deliverect.sourcePayloadKind).toBe("square_catalog_v1");
    expect(menu.categories[0]?.deliverectId).toBe(squareCategoryInternalId("cat_drinks"));
    expect(menu.products.map((p) => p.deliverectId)).toEqual([
      squareProductInternalId("var_latte_sm"),
      squareProductInternalId("var_latte_lg"),
    ]);
    expect(menu.products[0]?.name).toBe("Latte — Small");
    expect(menu.products[1]?.name).toBe("Latte — Large");
    // Standalone SKUs — must not set Deliverect variant-leaf fields (storefront would hide them).
    expect(menu.products[0]?.deliverectVariantParentPlu).toBeNull();
    expect(menu.products[1]?.deliverectVariantParentPlu).toBeNull();
    expect(menu.products[0]?.sourceParentExternalId).toBe("item_latte");
    expect(menu.products[1]?.sourceParentExternalId).toBe("item_latte");
    expect(menu.products[0]?.priceCents).toBe(450);
    expect(menu.products[1]?.priceCents).toBe(550);
    expect(menu.products[0]?.modifierGroupDeliverectIds).toEqual([
      squareModifierGroupInternalId("modlist_milk"),
    ]);
    expect(menu.products[1]?.modifierGroupDeliverectIds).toEqual([
      squareModifierGroupInternalId("modlist_milk"),
    ]);
    expect(menu.categories[0]?.productDeliverectIds).toEqual([
      squareProductInternalId("var_latte_sm"),
      squareProductInternalId("var_latte_lg"),
    ]);
    expect(menu.modifierGroupDefinitions[0]?.deliverectId).toBe(
      squareModifierGroupInternalId("modlist_milk")
    );
    expect(menu.modifierGroupDefinitions[0]?.isRequired).toBe(true);
    expect(menu.modifierGroupDefinitions[0]?.options[0]?.deliverectId).toBe(
      squareModifierOptionInternalId("mod_oat")
    );
    expect(result.warnings.some((w) => w.code === "item_flattened_variations")).toBe(true);
  });

  it("uses item name only when a single variation exists", () => {
    const objects = baseCatalog().filter((o) => o.id !== "var_latte_lg");
    const result = normalizeSquareCatalogToCanonical({
      vendorId: "vendor_1",
      locationId: LOCATION_ID,
      objects,
    });
    expect(result.menu?.products).toHaveLength(1);
    expect(result.menu?.products[0]?.name).toBe("Latte");
    expect(result.menu?.products[0]?.deliverectVariantParentPlu).toBeNull();
    expect(result.menu?.products[0]?.sourceParentExternalId).toBe("item_latte");
    expect(result.warnings.some((w) => w.code === "item_flattened_variations")).toBe(false);
  });

  it("skips deleted objects and variations without price", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "CATEGORY",
        id: "cat_food",
        present_at_all_locations: true,
        category_data: { name: "Food" },
      },
      {
        type: "ITEM",
        id: "item_deleted",
        is_deleted: true,
        present_at_all_locations: true,
        item_data: { name: "Deleted", categories: [{ id: "cat_food" }] },
      },
      {
        type: "ITEM",
        id: "item_no_price",
        present_at_all_locations: true,
        item_data: { name: "No price", categories: [{ id: "cat_food" }] },
      },
      {
        type: "ITEM_VARIATION",
        id: "var_no_price",
        present_at_all_locations: true,
        item_variation_data: { name: "Regular", item_id: "item_no_price" },
      },
    ];

    const result = normalizeSquareCatalogToCanonical({
      vendorId: "vendor_1",
      locationId: LOCATION_ID,
      objects,
    });

    expect(result.menu).toBeNull();
    expect(result.skipped.some((s) => s.squareObjectId === "var_no_price")).toBe(true);
    expect(result.skipped.some((s) => s.squareObjectId === "item_no_price")).toBe(true);
  });

  it("warns when modifier selection rules are unclear", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "CATEGORY",
        id: "cat_1",
        present_at_all_locations: true,
        category_data: { name: "Cat" },
      },
      {
        type: "ITEM",
        id: "item_1",
        present_at_all_locations: true,
        item_data: {
          name: "Burger",
          categories: [{ id: "cat_1" }],
          modifier_list_info: [{ modifier_list_id: "ml_1", enabled: true }],
        },
      },
      {
        type: "ITEM_VARIATION",
        id: "var_1",
        present_at_all_locations: true,
        item_variation_data: {
          item_id: "item_1",
          price_money: { amount: 1000, currency: "USD" },
        },
      },
      {
        type: "MODIFIER_LIST",
        id: "ml_1",
        present_at_all_locations: true,
        modifier_list_data: {
          name: "Extras",
          selection_type: "UNKNOWN",
          modifiers: [{ id: "m_1", type: "MODIFIER" }],
        },
      },
      {
        type: "MODIFIER",
        id: "m_1",
        present_at_all_locations: true,
        modifier_data: {
          name: "Cheese",
          price_money: { amount: 100, currency: "USD" },
        },
      },
    ];

    const result = normalizeSquareCatalogToCanonical({
      vendorId: "vendor_1",
      locationId: LOCATION_ID,
      objects,
    });

    expect(result.menu?.modifierGroupDefinitions[0]?.isRequired).toBe(false);
    expect(result.warnings.some((w) => w.code === "modifier_rules_partial")).toBe(true);
  });
});
