import { describe, expect, it } from "vitest";
import {
  validateModifierGroupBounds,
  validateOpenOrderModifierGroupRow,
} from "@/lib/open-order-modifier-validation";

describe("open-order-modifier-validation", () => {
  it("accepts required single-choice bounds", () => {
    expect(
      validateModifierGroupBounds({ required: true, minSelections: 1, maxSelections: 1 })
    ).toEqual({
      ok: true,
      bounds: { required: true, minSelections: 1, maxSelections: 1 },
    });
  });

  it("accepts optional multi-choice bounds", () => {
    expect(
      validateModifierGroupBounds({ required: false, minSelections: 0, maxSelections: 5 })
    ).toMatchObject({ ok: true });
  });

  it("rejects max less than min", () => {
    expect(
      validateModifierGroupBounds({ required: false, minSelections: 2, maxSelections: 1 }).ok
    ).toBe(false);
  });

  it("rejects required group with min 0", () => {
    expect(
      validateModifierGroupBounds({ required: true, minSelections: 0, maxSelections: 1 }).ok
    ).toBe(false);
  });

  it("blocks required group without enough available options", () => {
    const issue = validateOpenOrderModifierGroupRow(
      {
        name: "Protein",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        isAvailable: true,
        options: [
          { name: "Chicken", priceCents: 0, isAvailable: false },
          { name: "Beef", priceCents: 100, isAvailable: false },
        ],
      },
      { itemName: "Bowl" }
    );
    expect(issue).toMatch(/available option/i);
  });
});
