import { describe, expect, it } from "vitest";
import deliverectFragment from "@/domain/menu-import/__examples__/deliverect-menu-fragment.sample.json";
import { runPhase1aDeliverectMenuImport } from "./phase1a-pipeline";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { hasBlockingIssues } from "@/domain/menu-import/issues";

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
