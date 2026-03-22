import { describe, expect, it } from "vitest";
import { diffCanonicalMenus } from "./canonical-diff";
import type { MennyuCanonicalMenu } from "./canonical.schema";

function baseMenu(overrides: Partial<MennyuCanonicalMenu> = {}): MennyuCanonicalMenu {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    categories: [],
    modifierGroupDefinitions: [],
    products: [],
    ...overrides,
  };
}

describe("diffCanonicalMenus", () => {
  it("treats full draft as added when no published baseline", () => {
    const draft = baseMenu({
      categories: [{ deliverectId: "c1", name: "Cat", sortOrder: 0, productDeliverectIds: ["p1"] }],
      products: [{ deliverectId: "p1", name: "Item", priceCents: 100, isAvailable: true, sortOrder: 0, modifierGroupDeliverectIds: [] }],
    });
    const d = diffCanonicalMenus(draft, null, null);
    expect(d.isFirstPublish).toBe(true);
    expect(d.summary.addedCategories).toBe(1);
    expect(d.summary.addedProducts).toBe(1);
    expect(d.removedProducts).toHaveLength(0);
  });

  it("detects price change and added product", () => {
    const published = baseMenu({
      products: [
        { deliverectId: "p1", name: "Item", priceCents: 100, isAvailable: true, sortOrder: 0, modifierGroupDeliverectIds: [] },
      ],
    });
    const draft = baseMenu({
      products: [
        { deliverectId: "p1", name: "Item", priceCents: 199, isAvailable: true, sortOrder: 0, modifierGroupDeliverectIds: [] },
        { deliverectId: "p2", name: "New", priceCents: 50, isAvailable: true, sortOrder: 1, modifierGroupDeliverectIds: [] },
      ],
    });
    const d = diffCanonicalMenus(draft, published, "mv_pub");
    expect(d.isFirstPublish).toBe(false);
    expect(d.publishedVersionId).toBe("mv_pub");
    expect(d.summary.changedPrices).toBe(1);
    expect(d.changedPrices[0]!.newCents).toBe(199);
    expect(d.summary.addedProducts).toBe(1);
  });
});
