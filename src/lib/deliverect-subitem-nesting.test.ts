import { describe, expect, it } from "vitest";
import {
  DELIVERECT_MAX_SUBITEM_NESTING,
  deliverectSubItemDepthFromLine,
  isDeliverectSubItemDepthAllowed,
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
