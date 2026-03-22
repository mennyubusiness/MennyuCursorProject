import { describe, expect, it } from "vitest";
import deliverectFragment from "@/domain/menu-import/__examples__/deliverect-menu-fragment.sample.json";
import { runPhase1aDeliverectMenuImport } from "./phase1a-pipeline";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { hasBlockingIssues } from "@/domain/menu-import/issues";
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";

describe("runPhase1aDeliverectMenuImport", () => {
  it("normalizes and validates the sample Deliverect fragment", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: deliverectFragment,
      vendorId: "vendor_sample",
      deliverect: {
        sourcePayloadKind: "deliverect_menu_api_v1",
        menuId: "sample-menu-001",
      },
    });

    expect(result.menu).not.toBeNull();
    expect(mennyuCanonicalMenuSchema.safeParse(result.menu).success).toBe(true);
    expect(result.ok).toBe(true);
    expect(hasBlockingIssues(result.allIssues)).toBe(false);
    expect(result.menu!.products).toHaveLength(1);
    expect(result.menu!.products[0]!.deliverectId).toBe("prod-burger-1");
  });

  it("returns blocking issue when root is not an object", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: "not-json-object",
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "ROOT_NOT_OBJECT")).toBe(true);
  });

  it("fails when products array is empty with EMPTY_PRODUCTS_COLLECTION (not MISSING / NO_VALID)", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: { products: [] },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "EMPTY_PRODUCTS_COLLECTION")).toBe(true);
    expect(result.normalizationIssues.some((i) => i.code === "MISSING_PRODUCTS_ARRAY")).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "NO_VALID_PRODUCTS")).toBe(false);
  });

  it("emits NO_VALID_PRODUCTS when products is non-empty but no row normalizes to a valid product", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: { products: [{}, { foo: 1 }] },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "NO_VALID_PRODUCTS")).toBe(true);
    expect(result.normalizationIssues.some((i) => i.code === "EMPTY_PRODUCTS_COLLECTION")).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "MISSING_PRODUCTS_ARRAY")).toBe(false);
  });

  it("fails when products is an empty object map (Menu Push style) with categories empty", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: { products: {}, categories: [] },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "EMPTY_PRODUCTS_COLLECTION")).toBe(true);
    expect(
      result.normalizationIssues.find((i) => i.code === "EMPTY_PRODUCTS_COLLECTION")?.message
    ).toContain("Products collection exists but contains no products");
    expect(result.normalizationIssues.some((i) => i.code === "MISSING_PRODUCTS_ARRAY")).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "NO_VALID_PRODUCTS")).toBe(false);
  });

  it("normalizes modifier groups from subProducts as string-keyed object map (Deliverect Menu Push)", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p1"] }],
        products: {
          p1: {
            _id: "p1",
            name: "Combo",
            price: 1000,
            subProducts: {
              "mg-size": {
                name: "Size",
                min: 1,
                max: 1,
                subProducts: {
                  "opt-s": { name: "Small", price: 0 },
                  "opt-l": { name: "Large", price: 100 },
                },
              },
            },
          },
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    const p = result.menu!.products.find((x) => x.deliverectId === "p1");
    expect(p?.modifierGroupDeliverectIds).toEqual(["mg-size"]);
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "mg-size");
    expect(g).toBeDefined();
    expect(g!.options.map((o) => o.deliverectId).sort()).toEqual(["opt-l", "opt-s"]);
  });

  it("resolves subProducts string references via top-level modifierGroups and modifiers", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "cat-1", name: "Food", productIds: ["p1"] }],
        modifierGroups: {
          mg1: {
            _id: "mg1",
            name: "Choose",
            min: 1,
            max: 1,
            subProducts: ["mod-a", "mod-b"],
          },
        },
        modifiers: {
          "mod-a": { _id: "mod-a", name: "Option A", price: 0 },
          "mod-b": { _id: "mod-b", name: "Option B", price: 100 },
        },
        products: {
          p1: { _id: "p1", name: "Item", price: 500, subProducts: ["mg1"] },
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products.find((p) => p.deliverectId === "p1")?.modifierGroupDeliverectIds).toEqual(["mg1"]);
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "mg1");
    expect(g?.options.map((o) => o.deliverectId).sort()).toEqual(["mod-a", "mod-b"]);
  });

  it("flattens nested modifier groups under a parent group's subProducts into leaf options", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "c1", name: "M", productIds: ["p1"] }],
        products: {
          p1: {
            _id: "p1",
            name: "Item",
            price: 300,
            subProducts: [
              {
                _id: "ga",
                name: "Outer",
                min: 1,
                max: 1,
                subProducts: [
                  {
                    _id: "gb",
                    name: "Inner group",
                    min: 1,
                    max: 1,
                    subProducts: [
                      { _id: "o1", name: "Leaf one", price: 0 },
                      { _id: "o2", name: "Leaf two", price: 50 },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    const ga = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "ga");
    expect(ga).toBeDefined();
    expect(ga!.options.map((o) => o.deliverectId)).toEqual(["o1", "o2"]);
    expect(result.normalizationIssues.some((i) => i.code === "OPTION_REF_POINTS_TO_GROUP")).toBe(false);
  });

  it("warns when subProducts group reference cannot be resolved", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        products: [{ _id: "p1", name: "Item", price: 100, subProducts: ["missing-group-id"] }],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.normalizationIssues.some((i) => i.code === "UNRESOLVED_SUB_PRODUCT_GROUP_REF")).toBe(true);
  });

  it("reads subproducts (lowercase) alias for modifier tree", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        products: [
          {
            _id: "p2",
            name: "Item",
            price: 500,
            subproducts: [
              {
                _id: "g1",
                name: "Add-on",
                min: 0,
                max: 2,
                subproducts: [{ _id: "o1", name: "Extra", price: 50 }],
              },
            ],
          },
        ],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products[0]!.modifierGroupDeliverectIds).toEqual(["g1"]);
    expect(result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "g1")?.options[0]!.deliverectId).toBe(
      "o1"
    );
  });

  it("maps Deliverect min=0 max=0 optional add-ons to unbounded maxSelections", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        products: [
          {
            _id: "p-toppings",
            name: "Pizza",
            price: 1200,
            subProducts: [
              {
                _id: "g-toppings",
                name: "Extra toppings",
                min: 0,
                max: 0,
                subProducts: [{ _id: "t1", name: "Pepperoni", price: 100 }],
              },
            ],
          },
        ],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "g-toppings");
    expect(g?.minSelections).toBe(0);
    expect(g?.maxSelections).toBe(MODIFIER_MAX_SELECTIONS_UNBOUNDED);
    expect(g?.isRequired).toBe(false);
  });

  it("maps minimum/maximum 0/0 on modifierGroups + subProducts id ref to unbounded (Deliverect menu map style)", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [{ _id: "c1", name: "Food", productIds: ["pizza1"] }],
        products: {
          pizza1: {
            _id: "pizza1",
            name: "Pizza",
            price: 999,
            subProducts: ["mg-extra-toppings"],
          },
        },
        modifierGroups: {
          "mg-extra-toppings": {
            _id: "mg-extra-toppings",
            name: "Add extra toppings",
            minimum: 0,
            maximum: 0,
            subProducts: [{ _id: "top-cheese", name: "Extra cheese", price: 100 }],
          },
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    const g = result.menu!.modifierGroupDefinitions.find((x) => x.deliverectId === "mg-extra-toppings");
    expect(g?.name).toBe("Add extra toppings");
    expect(g?.minSelections).toBe(0);
    expect(g?.maxSelections).toBe(MODIFIER_MAX_SELECTIONS_UNBOUNDED);
    expect(g?.options.map((o) => o.deliverectId)).toEqual(["top-cheese"]);
  });

  it("emits SUB_PRODUCTS_WRONG_TYPE when subProducts is a string", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        products: [{ _id: "px", name: "Bad", price: 100, subProducts: "not-a-tree" }],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.normalizationIssues.some((i) => i.code === "SUB_PRODUCTS_WRONG_TYPE")).toBe(true);
  });

  it("normalizes products from a string-keyed object map (Deliverect Menu Push style)", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [
          {
            _id: "cat-1",
            name: "Food",
            productIds: ["p1"],
          },
        ],
        products: {
          p1: { _id: "p1", name: "Bagel", price: 350, plu: "PLU-1" },
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products).toHaveLength(1);
    expect(result.menu!.products[0]!.deliverectId).toBe("p1");
    expect(result.menu!.categories[0]!.productDeliverectIds).toEqual(["p1"]);
    expect(result.normalizationIssues.some((i) => i.code === "MISSING_PRODUCTS_ARRAY")).toBe(false);
  });

  it("reads products nested under data when root has no products", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        data: {
          products: [{ _id: "x1", name: "Item", price: 100 }],
        },
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products[0]!.deliverectId).toBe("x1");
  });

  it("collects products from availabilities rows when they embed product objects", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        availabilities: [
          { dayOfWeek: 1, product: { _id: "avp1", name: "Coffee", price: 250 } },
          { product: { _id: "avp2", name: "Tea", price: 200 } },
        ],
        categories: [
          { _id: "c1", name: "Drinks", productIds: ["avp1", "avp2"] },
        ],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products.map((p) => p.deliverectId).sort()).toEqual(["avp1", "avp2"]);
    expect(result.menu!.categories[0]!.productDeliverectIds).toEqual(["avp1", "avp2"]);
  });

  it("collects products embedded as objects under categories when no top-level collection", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        categories: [
          {
            _id: "c1",
            name: "Mains",
            products: [{ _id: "ep1", name: "Soup", price: 500 }],
          },
        ],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
    });
    expect(result.menu).not.toBeNull();
    expect(result.menu!.products).toHaveLength(1);
    expect(result.menu!.products[0]!.deliverectId).toBe("ep1");
  });

  it("fails validation when two products share the same deliverect id", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: {
        products: [
          { _id: "dup", name: "A", price: 100 },
          { _id: "dup", name: "B", price: 200 },
        ],
      },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.validationIssues.length + result.normalizationIssues.length).toBeGreaterThan(0);
  });
});
