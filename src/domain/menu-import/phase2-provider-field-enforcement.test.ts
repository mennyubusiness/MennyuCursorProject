import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { normalizeSquareCatalogToCanonical } from "@/lib/integrations/square/square-catalog-normalizer";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";
import { menuImportJobLocationWrite } from "@/domain/menu-import/menu-import-job-location";
import { jobSourceLocationId, isVariantLeafProduct } from "@/domain/menu-import/canonical-identity";
import { computeCustomerMenuBrowseExcludedProductIds } from "@/domain/menu-import/customer-menu-browse";
import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";

const GENERIC_MODULES = [
  "src/services/menu-publish-from-canonical.service.ts",
  "src/services/vendor-customer-menu.service.ts",
  "src/services/vendor-customer-menu-cache.service.ts",
  "src/domain/menu-import/customer-menu-browse.ts",
];

/** Direct Deliverect-only leaf field access is forbidden in generic modules (use identity helpers). */
const FORBIDDEN_DIRECT = [
  /\.deliverectVariantParentPlu\b/,
  /\.deliverectVariantParentName\b/,
];

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsFiles(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("Phase 2 provider field enforcement", () => {
  it("Square normalization never sets deliverectVariantParentPlu/Name", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "CATEGORY",
        id: "cat_1",
        present_at_all_locations: true,
        category_data: { name: "Bowls" },
      },
      {
        type: "ITEM",
        id: "item_1",
        present_at_all_locations: true,
        item_data: { name: "Bowl", categories: [{ id: "cat_1" }] },
      },
      {
        type: "ITEM_VARIATION",
        id: "var_reg",
        present_at_all_locations: true,
        item_variation_data: {
          name: "Regular",
          item_id: "item_1",
          price_money: { amount: 1000, currency: "USD" },
        },
      },
      {
        type: "ITEM_VARIATION",
        id: "var_lg",
        present_at_all_locations: true,
        item_variation_data: {
          name: "Large",
          item_id: "item_1",
          price_money: { amount: 1400, currency: "USD" },
        },
      },
    ];

    const { menu } = normalizeSquareCatalogToCanonical({
      vendorId: "v1",
      locationId: "LOC",
      objects,
    });
    expect(menu).not.toBeNull();
    for (const p of menu!.products) {
      expect(p.deliverectVariantParentPlu).toBeNull();
      expect(p.deliverectVariantParentName).toBeNull();
      expect(p.sourceParentExternalId).toBe("item_1");
      expect(isVariantLeafProduct(p)).toBe(false);
    }
    expect(computeCustomerMenuBrowseExcludedProductIds(menu!).size).toBe(0);
  });

  it("Square import job location write never sets deliverectLocationId", () => {
    const cols = menuImportJobLocationWrite({
      source: "SQUARE_CATALOG_PULL",
      locationId: "LN123",
    });
    expect(cols.sourceLocationId).toBe("LN123");
    expect(cols.deliverectLocationId).toBeNull();
  });

  it("Deliverect import job location dual-writes sourceLocationId", () => {
    const cols = menuImportJobLocationWrite({
      source: "DELIVERECT_API_PULL",
      locationId: "LOC_D",
    });
    expect(cols.sourceLocationId).toBe("LOC_D");
    expect(cols.deliverectLocationId).toBe("LOC_D");
  });

  it("jobSourceLocationId dual-reads legacy deliverectLocationId", () => {
    expect(
      jobSourceLocationId({ sourceLocationId: "NEW", deliverectLocationId: "OLD" })
    ).toEqual({ locationId: "NEW", usedLegacyFallback: false });
    expect(
      jobSourceLocationId({ sourceLocationId: null, deliverectLocationId: "OLD" })
    ).toEqual({ locationId: "OLD", usedLegacyFallback: true });
  });

  it("manual open_order menus require no provider mapping fields for browse", () => {
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
        {
          deliverectId: "oo:prod:1",
          name: "Tea",
          priceCents: 300,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
          deliverectVariantParentPlu: null,
          sourceParentExternalId: null,
        },
      ],
    };
    expect(computeCustomerMenuBrowseExcludedProductIds(menu).size).toBe(0);
  });

  it("Deliverect variant leaves retain browse exclusion", () => {
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
          priceCents: 0,
          isAvailable: true,
          sortOrder: 1,
          modifierGroupDeliverectIds: [],
          deliverectVariantParentPlu: "BURGER-PLU",
        },
      ],
    };
    const ex = computeCustomerMenuBrowseExcludedProductIds(menu);
    expect(ex.has("leaf")).toBe(true);
    expect(ex.has("parent")).toBe(false);
  });

  it("generic storefront/publish/browse modules do not directly read Deliverect-only leaf fields", () => {
    const root = process.cwd();
    for (const rel of GENERIC_MODULES) {
      const src = readFileSync(join(root, rel), "utf8");
      // Allow imports of helpers and comments; forbid property access patterns.
      const withoutComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const re of FORBIDDEN_DIRECT) {
        expect(withoutComments, `${rel} must not match ${re}`).not.toMatch(re);
      }
    }
  });

  it("square-menu-import.service does not write deliverectLocationId with a location variable", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/integrations/square/square-menu-import.service.ts"),
      "utf8"
    );
    expect(src).toMatch(/menuImportJobLocationWrite/);
    expect(src).not.toMatch(/deliverectLocationId:\s*locationId/);
  });
});
