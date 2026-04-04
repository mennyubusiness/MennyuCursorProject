import { describe, expect, it } from "vitest";
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";
import { formatModifierGroupShortNote } from "./modifier-group-display";

describe("formatModifierGroupShortNote", () => {
  it("exact count", () => {
    expect(
      formatModifierGroupShortNote({ minSelections: 1, maxSelections: 1 })
    ).toBe("choose 1");
  });

  it("optional bounded", () => {
    expect(
      formatModifierGroupShortNote({ minSelections: 0, maxSelections: 3 })
    ).toBe("choose up to 3");
  });

  it("unbounded optional", () => {
    expect(
      formatModifierGroupShortNote({
        minSelections: 0,
        maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
      })
    ).toBe("choose any");
  });

  it("range", () => {
    expect(
      formatModifierGroupShortNote({ minSelections: 2, maxSelections: 4 })
    ).toBe("choose 2–4");
  });
});
