import { describe, expect, it } from "vitest";
import { validateOpenOrderMenuBuilderState } from "@/lib/open-order-menu-validation";

describe("open-order-menu-validation", () => {
  it("requires visible category and item with valid price", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [],
      items: [],
    });
    expect(result.ready).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("NO_VISIBLE_CATEGORY");
  });

  it("passes with one visible category and valid item", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [{ id: "cat1", name: "Mains", sortOrder: 0, isVisible: true }],
      items: [
        {
          id: "item1",
          name: "Burger",
          description: null,
          priceCents: 1200,
          isAvailable: true,
          sortOrder: 0,
          deliverectCategoryId: "oo:cat:cat1",
          deliverectProductId: "oo:prod:item1",
          updatedAt: new Date(),
        },
      ],
    });
    expect(result.ready).toBe(true);
    expect(result.visibleItemCount).toBe(1);
  });

  it("rejects negative prices", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [{ id: "cat1", name: "Mains", sortOrder: 0, isVisible: true }],
      items: [
        {
          id: "item1",
          name: "Burger",
          description: null,
          priceCents: -1,
          isAvailable: true,
          sortOrder: 0,
          deliverectCategoryId: "oo:cat:cat1",
          deliverectProductId: "oo:prod:item1",
          updatedAt: new Date(),
        },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.code === "INVALID_ITEM_PRICE")).toBe(true);
  });

  it("rejects required group without enough available options in menu validation", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [{ id: "cat1", name: "Mains", sortOrder: 0, isVisible: true }],
      items: [
        {
          id: "item1",
          name: "Bowl",
          description: null,
          priceCents: 1200,
          isAvailable: true,
          sortOrder: 0,
          deliverectCategoryId: "oo:cat:cat1",
          deliverectProductId: "oo:prod:item1",
          updatedAt: new Date(),
          modifierGroups: [
            {
              name: "Protein",
              required: true,
              minSelections: 1,
              maxSelections: 1,
              isAvailable: true,
              options: [{ name: "Chicken", priceCents: 0, isAvailable: false }],
            },
          ],
        },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.code === "INVALID_MODIFIER_GROUP")).toBe(true);
  });
});
