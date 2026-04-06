import { describe, expect, it } from "vitest";
import {
  DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH,
  countSubItemsChainVariantSelections,
  deliverectSubItemsChainDepth,
  deliverectSubItemsChainLimitMessage,
  isDeliverectSubItemsChainDepthAllowed,
  isTopLevelDeliverectVariantGroupModifierGroup,
} from "./deliverect-subitem-nesting";

describe("deliverectSubItemsChainDepth", () => {
  it("counts chain variant steps without parent PLU wrapper", () => {
    expect(
      deliverectSubItemsChainDepth({
        hasDeliverectVariantParentPlu: false,
        chainVariantStepCount: 3,
      })
    ).toBe(3);
    expect(
      deliverectSubItemsChainDepth({
        hasDeliverectVariantParentPlu: false,
        chainVariantStepCount: 4,
      })
    ).toBe(4);
  });

  it("adds one level when using Deliverect variant parent + leaf PLU", () => {
    expect(
      deliverectSubItemsChainDepth({
        hasDeliverectVariantParentPlu: true,
        chainVariantStepCount: 2,
      })
    ).toBe(3);
    expect(
      deliverectSubItemsChainDepth({
        hasDeliverectVariantParentPlu: true,
        chainVariantStepCount: 3,
      })
    ).toBe(4);
  });

  it("enforces Deliverect max subItems nesting depth", () => {
    expect(DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH).toBe(3);
    expect(
      isDeliverectSubItemsChainDepthAllowed({
        hasDeliverectVariantParentPlu: false,
        chainVariantStepCount: 3,
      })
    ).toBe(true);
    expect(
      isDeliverectSubItemsChainDepthAllowed({
        hasDeliverectVariantParentPlu: false,
        chainVariantStepCount: 4,
      })
    ).toBe(false);
    expect(
      isDeliverectSubItemsChainDepthAllowed({
        hasDeliverectVariantParentPlu: true,
        chainVariantStepCount: 2,
      })
    ).toBe(true);
    expect(
      isDeliverectSubItemsChainDepthAllowed({
        hasDeliverectVariantParentPlu: true,
        chainVariantStepCount: 3,
      })
    ).toBe(false);
  });
});

describe("countSubItemsChainVariantSelections", () => {
  const g = (variant: boolean, parent: string | null) => ({
    modifierGroup: { deliverectIsVariantGroup: variant, parentModifierOptionId: parent },
  });

  it("counts only top-level variant groups toward the root subItems chain", () => {
    expect(
      countSubItemsChainVariantSelections({
        selections: [
          { modifierOption: g(true, null) },
          { modifierOption: g(true, null) },
          { modifierOption: g(true, "opt-parent") },
        ],
      })
    ).toBe(2);
  });

  it("does not count nested groups even when flagged as variant group", () => {
    expect(
      isTopLevelDeliverectVariantGroupModifierGroup({
        deliverectIsVariantGroup: true,
        parentModifierOptionId: "p1",
      })
    ).toBe(false);
  });
});

describe("deliverectSubItemsChainLimitMessage", () => {
  it("mentions Deliverect, top-level variant groups, and excludes nested add-ons", () => {
    const msg = deliverectSubItemsChainLimitMessage("Pizza", 2);
    expect(msg).toContain("Deliverect");
    expect(msg).toContain("Pizza");
    expect(msg).toMatch(/2 nested menu levels/);
    expect(msg).toMatch(/main item/);
    expect(msg).toMatch(/not toppings or add-ons nested under another choice/);
  });
});
