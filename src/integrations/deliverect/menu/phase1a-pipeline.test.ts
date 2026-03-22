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

  it("fails when products array is empty", () => {
    const result = runPhase1aDeliverectMenuImport({
      raw: { products: [] },
      vendorId: "v1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    });
    expect(result.menu).toBeNull();
    expect(result.ok).toBe(false);
    expect(result.normalizationIssues.some((i) => i.code === "NO_VALID_PRODUCTS")).toBe(true);
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
