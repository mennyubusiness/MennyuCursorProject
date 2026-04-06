import { describe, expect, it } from "vitest";
import {
  DELIVERECT_MAX_SUBITEM_NESTING,
  countTopLevelDeliverectVariantGroupSelections,
  deliverectSubItemDepthFromLine,
  isDeliverectSubItemDepthAllowed,
  isTopLevelDeliverectVariantGroupModifierGroup,
} from "./deliverect-subitem-nesting";

describe("deliverectSubItemDepthFromLine", () => {
  it("counts shell-only variant groups without parent PLU", () => {
    expect(
      deliverectSubItemDepthFromLine({
        hasDeliverectVariantParentPlu: false,
        variantGroupSelectionCount: 3,
      })
    ).toBe(3);
    expect(
      deliverectSubItemDepthFromLine({
        hasDeliverectVariantParentPlu: false,
        variantGroupSelectionCount: 4,
      })
    ).toBe(4);
  });

  it("adds one level when using Deliverect variant parent + leaf PLU", () => {
    expect(
      deliverectSubItemDepthFromLine({
        hasDeliverectVariantParentPlu: true,
        variantGroupSelectionCount: 2,
      })
    ).toBe(3);
    expect(
      deliverectSubItemDepthFromLine({
        hasDeliverectVariantParentPlu: true,
        variantGroupSelectionCount: 3,
      })
    ).toBe(4);
  });

  it("enforces MAX nesting", () => {
    expect(DELIVERECT_MAX_SUBITEM_NESTING).toBe(3);
    expect(
      isDeliverectSubItemDepthAllowed({
        hasDeliverectVariantParentPlu: false,
        variantGroupSelectionCount: 3,
      })
    ).toBe(true);
    expect(
      isDeliverectSubItemDepthAllowed({
        hasDeliverectVariantParentPlu: false,
        variantGroupSelectionCount: 4,
      })
    ).toBe(false);
    expect(
      isDeliverectSubItemDepthAllowed({
        hasDeliverectVariantParentPlu: true,
        variantGroupSelectionCount: 2,
      })
    ).toBe(true);
    expect(
      isDeliverectSubItemDepthAllowed({
        hasDeliverectVariantParentPlu: true,
        variantGroupSelectionCount: 3,
      })
    ).toBe(false);
  });
});

describe("countTopLevelDeliverectVariantGroupSelections", () => {
  const g = (variant: boolean, parent: string | null) => ({
    modifierGroup: { deliverectIsVariantGroup: variant, parentModifierOptionId: parent },
  });

  it("counts only top-level variant groups toward the subItems chain", () => {
    expect(
      countTopLevelDeliverectVariantGroupSelections({
        selections: [
          { modifierOption: g(true, null) },
          { modifierOption: g(true, null) },
          { modifierOption: g(true, "opt-parent") },
        ],
      })
    ).toBe(2);
  });

  it("does not count nested groups even when flagged as variant group", () => {
    expect(isTopLevelDeliverectVariantGroupModifierGroup({ deliverectIsVariantGroup: true, parentModifierOptionId: "p1" })).toBe(
      false
    );
  });
});
