/**
 * Regression: Square multi-variation items must remain visible on the customer storefront
 * after normalize → browse filter (the same exclusion used post-publish).
 */
import { describe, expect, it } from "vitest";
import {
  explainCustomerMenuBrowseExclusions,
  computeCustomerMenuBrowseExcludedProductIds,
} from "@/domain/menu-import/customer-menu-browse";
import { normalizeSquareCatalogToCanonical } from "@/lib/integrations/square/square-catalog-normalizer";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";
import {
  parseSquareExternalId,
  squareCategoryInternalId,
  squareModifierGroupInternalId,
  squareProductInternalId,
} from "@/lib/integrations/square/square-menu-ids";

const LOCATION_ID = "LOC_POKE";

function pokeStyleCatalog(): SquareCatalogObject[] {
  return [
    {
      type: "CATEGORY",
      id: "cat_signature",
      present_at_all_locations: true,
      category_data: { name: "Signature Bowls" },
    },
    {
      type: "CATEGORY",
      id: "cat_byo",
      present_at_all_locations: true,
      category_data: { name: "Build Your Own" },
    },
    {
      type: "CATEGORY",
      id: "cat_addons",
      present_at_all_locations: true,
      category_data: { name: "Add-ons" },
    },
    {
      type: "ITEM",
      id: "item_captain",
      present_at_all_locations: true,
      item_data: {
        name: "The Captain's Classic",
        categories: [{ id: "cat_signature" }],
        modifier_list_info: [{ modifier_list_id: "modlist_protein", enabled: true }],
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_captain_reg",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Regular",
        item_id: "item_captain",
        price_money: { amount: 1299, currency: "USD" },
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_captain_lg",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Large",
        item_id: "item_captain",
        price_money: { amount: 1599, currency: "USD" },
      },
    },
    {
      type: "ITEM",
      id: "item_byo",
      present_at_all_locations: true,
      item_data: {
        name: "Build Your Own Poke Bowl",
        categories: [{ id: "cat_byo" }],
        modifier_list_info: [{ modifier_list_id: "modlist_protein", enabled: true }],
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_byo_reg",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Regular",
        item_id: "item_byo",
        price_money: { amount: 1100, currency: "USD" },
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_byo_lg",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Large",
        item_id: "item_byo",
        price_money: { amount: 1400, currency: "USD" },
      },
    },
    {
      type: "ITEM",
      id: "item_extra_protein",
      present_at_all_locations: true,
      item_data: {
        name: "Extra Protein",
        categories: [{ id: "cat_addons" }],
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_protein_chicken",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Chicken",
        item_id: "item_extra_protein",
        price_money: { amount: 300, currency: "USD" },
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_protein_ahi",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Ahi Tuna",
        item_id: "item_extra_protein",
        price_money: { amount: 450, currency: "USD" },
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_protein_salmon",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Salmon",
        item_id: "item_extra_protein",
        price_money: { amount: 450, currency: "USD" },
      },
    },
    {
      type: "ITEM",
      id: "item_single",
      present_at_all_locations: true,
      item_data: {
        name: "Miso Soup",
        categories: [{ id: "cat_addons" }],
      },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_miso",
      present_at_all_locations: true,
      item_variation_data: {
        name: "Regular",
        item_id: "item_single",
        price_money: { amount: 250, currency: "USD" },
      },
    },
    {
      type: "MODIFIER_LIST",
      id: "modlist_protein",
      present_at_all_locations: true,
      modifier_list_data: {
        name: "Choose a Protein",
        selection_type: "SINGLE",
        modifiers: [{ id: "mod_ahi", type: "MODIFIER" }],
      },
    },
    {
      type: "MODIFIER",
      id: "mod_ahi",
      present_at_all_locations: true,
      modifier_data: {
        name: "Ahi",
        price_money: { amount: 0, currency: "USD" },
        modifier_list_id: "modlist_protein",
      },
    },
  ];
}

/** Mirrors storefront section building: drop browse-excluded products, omit empty categories. */
function visibleCustomerSections(menu: NonNullable<ReturnType<typeof normalizeSquareCatalogToCanonical>["menu"]>) {
  const excluded = computeCustomerMenuBrowseExcludedProductIds(menu);
  const sections: Array<{ id: string; name: string; productIds: string[] }> = [];
  for (const cat of [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const productIds = cat.productDeliverectIds.filter((pid) => !excluded.has(pid));
    if (productIds.length > 0) {
      sections.push({ id: cat.deliverectId, name: cat.name, productIds });
    }
  }
  return sections;
}

describe("Square multi-variation customer visibility after publish rules", () => {
  it("keeps two variation-derived items visible under their category with modifiers and Square mappings", () => {
    const { menu } = normalizeSquareCatalogToCanonical({
      vendorId: "poke-sea",
      locationId: LOCATION_ID,
      objects: pokeStyleCatalog(),
    });
    expect(menu).not.toBeNull();
    const m = menu!;

    const captainReg = m.products.find((p) => p.deliverectId === squareProductInternalId("var_captain_reg"));
    const captainLg = m.products.find((p) => p.deliverectId === squareProductInternalId("var_captain_lg"));
    expect(captainReg).toBeDefined();
    expect(captainLg).toBeDefined();
    expect(captainReg!.name).toBe("The Captain's Classic — Regular");
    expect(captainLg!.name).toBe("The Captain's Classic — Large");
    expect(captainReg!.priceCents).toBe(1299);
    expect(captainLg!.priceCents).toBe(1599);

    // Not Deliverect variant leaves — otherwise storefront browse would hide them.
    expect(captainReg!.deliverectVariantParentPlu).toBeNull();
    expect(captainLg!.deliverectVariantParentPlu).toBeNull();

    // Parent Square ITEM + variation ids retained for order routing / diagnostics.
    expect(captainReg!.sourceParentExternalId).toBe("item_captain");
    expect(captainLg!.sourceParentExternalId).toBe("item_captain");
    expect(parseSquareExternalId(captainReg!.deliverectId)).toBe("var_captain_reg");
    expect(parseSquareExternalId(captainLg!.deliverectId)).toBe("var_captain_lg");

    const proteinGroup = squareModifierGroupInternalId("modlist_protein");
    expect(captainReg!.modifierGroupDeliverectIds).toContain(proteinGroup);
    expect(captainLg!.modifierGroupDeliverectIds).toContain(proteinGroup);
    expect(m.deliverect.locationId).toBe(LOCATION_ID);
    expect(m.deliverect.sourcePayloadKind).toBe("square_catalog_v1");

    const excluded = computeCustomerMenuBrowseExcludedProductIds(m);
    expect(excluded.has(captainReg!.deliverectId)).toBe(false);
    expect(excluded.has(captainLg!.deliverectId)).toBe(false);
    expect(explainCustomerMenuBrowseExclusions(m)).toEqual([]);

    const sections = visibleCustomerSections(m);
    const signature = sections.find((s) => s.id === squareCategoryInternalId("cat_signature"));
    expect(signature).toBeDefined();
    expect(signature!.productIds).toEqual(
      expect.arrayContaining([captainReg!.deliverectId, captainLg!.deliverectId])
    );
  });

  it("keeps categories that only contain variation-derived items", () => {
    const { menu } = normalizeSquareCatalogToCanonical({
      vendorId: "poke-sea",
      locationId: LOCATION_ID,
      objects: pokeStyleCatalog(),
    });
    const sections = visibleCustomerSections(menu!);
    expect(sections.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Signature Bowls", "Build Your Own", "Add-ons"])
    );

    const byo = sections.find((s) => s.id === squareCategoryInternalId("cat_byo"));
    expect(byo?.productIds).toHaveLength(2);

    const addons = sections.find((s) => s.id === squareCategoryInternalId("cat_addons"));
    expect(addons?.productIds).toEqual(
      expect.arrayContaining([
        squareProductInternalId("var_protein_chicken"),
        squareProductInternalId("var_protein_ahi"),
        squareProductInternalId("var_protein_salmon"),
        squareProductInternalId("var_miso"),
      ])
    );
  });

  it("leaves single-variation imports unchanged (item name, parent id, visible)", () => {
    const { menu } = normalizeSquareCatalogToCanonical({
      vendorId: "poke-sea",
      locationId: LOCATION_ID,
      objects: pokeStyleCatalog(),
    });
    const miso = menu!.products.find((p) => p.deliverectId === squareProductInternalId("var_miso"));
    expect(miso?.name).toBe("Miso Soup");
    expect(miso?.deliverectVariantParentPlu).toBeNull();
    expect(miso?.sourceParentExternalId).toBe("item_single");
    expect(computeCustomerMenuBrowseExcludedProductIds(menu!).has(miso!.deliverectId)).toBe(false);
  });

  it("explains Deliverect-style leaf exclusions when parent PLU is set (control)", () => {
    const { menu } = normalizeSquareCatalogToCanonical({
      vendorId: "v",
      locationId: LOCATION_ID,
      objects: pokeStyleCatalog(),
    });
    const broken = {
      ...menu!,
      products: menu!.products.map((p, i) =>
        i === 0
          ? {
              ...p,
              deliverectVariantParentPlu: p.sourceParentExternalId ?? "PARENT",
              deliverectVariantParentName: "Parent",
            }
          : p
      ),
    };
    const explained = explainCustomerMenuBrowseExclusions(broken);
    expect(explained).toHaveLength(1);
    expect(explained[0]?.reason).toBe("variant_leaf");
    expect(explained[0]?.productDeliverectId).toBe(menu!.products[0]!.deliverectId);
  });
});
