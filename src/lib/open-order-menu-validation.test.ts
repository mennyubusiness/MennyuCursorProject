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

  it("rejects required group without available options", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [{ id: "cat1", name: "Mains", sortOrder: 0, isVisible: true }],
      items: [
        {
          id: "item1",
          name: "Chicken Burrito",
          description: null,
          priceCents: 1200,
          isAvailable: true,
          sortOrder: 0,
          deliverectCategoryId: "oo:cat:cat1",
          deliverectProductId: "oo:prod:item1",
          updatedAt: new Date(),
          modifierGroups: [
            {
              name: "Choose your protein",
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
    expect(result.issues.some((i) => i.message.includes("required modifier group"))).toBe(true);
  });

  it("flags empty visible categories", () => {
    const result = validateOpenOrderMenuBuilderState({
      categories: [
        { id: "cat1", name: "Mains", sortOrder: 0, isVisible: true },
        { id: "cat2", name: "Sides", sortOrder: 1, isVisible: true },
      ],
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
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Sides"))).toBe(true);
  });
});
