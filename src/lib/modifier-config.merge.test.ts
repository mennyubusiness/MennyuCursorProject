import { describe, expect, it } from "vitest";
import { mergeVariantParentAndLeafModifierConfig } from "./modifier-config";
import type { ModifierConfigForUI, ModifierGroupLinkForUI } from "./modifier-config";

function mkGroup(
  id: string,
  name: string,
  opts: { variant?: boolean; sortOrder?: number; options?: ModifierGroupLinkForUI["modifierGroup"]["options"] }
): ModifierGroupLinkForUI {
  return {
    required: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: opts.sortOrder ?? 0,
    modifierGroup: {
      id,
      name,
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      isAvailable: true,
      deliverectIsVariantGroup: opts.variant ? true : false,
      options: opts.options ?? [],
    },
  };
}

describe("mergeVariantParentAndLeafModifierConfig", () => {
  it("includes leaf groups even when deliverectIsVariantGroup is wrongly true on leaf (different group id than parent size)", () => {
    const parent: ModifierConfigForUI = {
      menuItemId: "parent",
      menuItemName: "Shell",
      priceCents: 0,
      groups: [mkGroup("g-size", "Choose Size", { variant: true, sortOrder: 0, options: [] })],
      useLeafModifierMerge: true,
    };
    const leaf: ModifierConfigForUI = {
      menuItemId: "leaf",
      menuItemName: "Medium",
      priceCents: 1800,
      groups: [
        // Mis-tagged as variant but distinct id — should still appear (crust)
        mkGroup("g-crust", "Choose Pizza Crust", { variant: true, sortOrder: 1, options: [] }),
      ],
    };
    const merged = mergeVariantParentAndLeafModifierConfig(parent, leaf, {
      menuItemName: leaf.menuItemName,
      priceCents: leaf.priceCents,
    });
    expect(merged.groups.map((g) => g.modifierGroup.name)).toEqual(["Choose Size", "Choose Pizza Crust"]);
  });
});
