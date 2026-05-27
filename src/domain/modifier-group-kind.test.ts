import { describe, expect, it } from "vitest";
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";
import {
  classifyOpenOrderModifierGroup,
  classificationInputFromMenuItemLink,
  groupSatisfiesCartRules,
} from "@/domain/modifier-group-kind";

describe("classifyOpenOrderModifierGroup", () => {
  it("optional sauce group with Deliverect variant metadata and min 0 → OPTIONAL_VARIANT_OR_MODIFIER_GROUP", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: true,
      minSelections: 0,
      maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
    });
    expect(c.kind).toBe("OPTIONAL_VARIANT_OR_MODIFIER_GROUP");
    expect(c.blocksAddToCartWhenEmpty).toBe(false);
    expect(c.requiresDeliverectVariantLeafResolution).toBe(false);
    expect(c.usesDeliverectSubItemsChain).toBe(false);
  });

  it("true required size group with variant children → REQUIRED_VARIANT_GROUP", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: true,
      minSelections: 1,
      maxSelections: 1,
      required: true,
      isAvailable: true,
      variantChildMenuItemCount: 3,
    });
    expect(c.kind).toBe("REQUIRED_VARIANT_GROUP");
    expect(c.blocksAddToCartWhenEmpty).toBe(true);
    expect(c.requiresDeliverectVariantLeafResolution).toBe(true);
    expect(c.usesDeliverectSubItemsChain).toBe(true);
  });

  it("required modifier group (not variant) → REQUIRED_MODIFIER_GROUP", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: false,
      minSelections: 1,
      maxSelections: 3,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
    });
    expect(c.kind).toBe("REQUIRED_MODIFIER_GROUP");
    expect(c.blocksAddToCartWhenEmpty).toBe(true);
  });

  it("optional group with max 1 → LIMITED_OPTIONAL_MODIFIER_GROUP", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: false,
      minSelections: 0,
      maxSelections: 1,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
    });
    expect(c.kind).toBe("LIMITED_OPTIONAL_MODIFIER_GROUP");
    expect(c.blocksAddToCartWhenEmpty).toBe(false);
    expect(groupSatisfiesCartRules(c, 2).ok).toBe(false);
    expect(groupSatisfiesCartRules(c, 0).ok).toBe(true);
  });

  it("optional unlimited group → FREE_CHOICE_MODIFIER_GROUP", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: false,
      minSelections: 0,
      maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
    });
    expect(c.kind).toBe("FREE_CHOICE_MODIFIER_GROUP");
    expect(groupSatisfiesCartRules(c, 0).ok).toBe(true);
  });

  it("unavailable required group fails cart rules", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: false,
      minSelections: 1,
      maxSelections: 1,
      required: true,
      isAvailable: false,
      variantChildMenuItemCount: 0,
    });
    expect(c.kind).toBe("REQUIRED_MODIFIER_GROUP");
    expect(c.blocksAddToCartWhenEmpty).toBe(false);
    expect(groupSatisfiesCartRules(c, 0).ok).toBe(false);
    expect(groupSatisfiesCartRules(c, 0).code).toBe("MODIFIER_GROUP_UNAVAILABLE");
  });

  it("nested required modifier uses same REQUIRED_MODIFIER_GROUP semantics", () => {
    const c = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: false,
      minSelections: 1,
      maxSelections: 1,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
      isNested: true,
    });
    expect(c.kind).toBe("REQUIRED_MODIFIER_GROUP");
    expect(c.usesDeliverectSubItemsChain).toBe(false);
    expect(groupSatisfiesCartRules(c, 0).ok).toBe(false);
    expect(groupSatisfiesCartRules(c, 1).ok).toBe(true);
  });
});

describe("classificationInputFromMenuItemLink", () => {
  it("uses link bounds over group defaults for classification", () => {
    const input = classificationInputFromMenuItemLink(
      {
        required: false,
        minSelections: 0,
        maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
        modifierGroup: {
          deliverectIsVariantGroup: true,
          isAvailable: true,
          parentModifierOptionId: null,
        },
      },
      0
    );
    expect(classifyOpenOrderModifierGroup(input).kind).toBe("OPTIONAL_VARIANT_OR_MODIFIER_GROUP");
  });
});
