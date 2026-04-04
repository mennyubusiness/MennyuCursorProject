import { describe, expect, it } from "vitest";
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";
import { formatModifierGroupSelectionHint } from "./modifier-group-display";

describe("formatModifierGroupSelectionHint", () => {
  it("optional unbounded non-variant: choose any", () => {
    expect(
      formatModifierGroupSelectionHint({
        minSelections: 0,
        maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
        required: false,
        deliverectIsVariantGroup: false,
        deliverectOnlineOrderApplies: true,
        deliverectMaxVariantStepsForItem: 3,
      })
    ).toBe("optional — choose any");
  });

  it("optional unbounded variant + online: shows global online cap (not raw import)", () => {
    expect(
      formatModifierGroupSelectionHint({
        minSelections: 0,
        maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
        required: false,
        deliverectIsVariantGroup: true,
        deliverectOnlineOrderApplies: true,
        deliverectMaxVariantStepsForItem: 3,
      })
    ).toBe("optional — up to 3 variation choices total (online order limit)");
  });

  it("optional unbounded variant without online link: same as non-Deliverect (choose any)", () => {
    expect(
      formatModifierGroupSelectionHint({
        minSelections: 0,
        maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
        required: false,
        deliverectIsVariantGroup: true,
        deliverectOnlineOrderApplies: false,
        deliverectMaxVariantStepsForItem: null,
      })
    ).toBe("optional — choose any");
  });

  it("exact required count", () => {
    expect(
      formatModifierGroupSelectionHint({
        minSelections: 1,
        maxSelections: 1,
        required: true,
        deliverectIsVariantGroup: false,
        deliverectOnlineOrderApplies: false,
        deliverectMaxVariantStepsForItem: null,
      })
    ).toBe("choose 1, required");
  });

  it("bounded optional", () => {
    expect(
      formatModifierGroupSelectionHint({
        minSelections: 0,
        maxSelections: 3,
        required: false,
        deliverectIsVariantGroup: false,
        deliverectOnlineOrderApplies: false,
        deliverectMaxVariantStepsForItem: null,
      })
    ).toBe("optional — choose up to 3 total");
  });
});
