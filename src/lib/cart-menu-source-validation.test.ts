import { describe, expect, it } from "vitest";
import {
  DELIVERECT_ITEM_KITCHEN_MAPPING_MESSAGE,
  OPEN_ORDER_ITEM_NOT_ORDERABLE_MESSAGE,
  deliverectItemKitchenMappingMessage,
  validateDeliverectModifierKitchenMapping,
  validateDeliverectProductKitchenMapping,
  vendorRequiresDeliverectKitchenMapping,
  vendorUsesDeliverectSubItemsNestingRules,
} from "@/lib/cart-menu-source-validation";

describe("cart-menu-source-validation", () => {
  it("requires kitchen mapping only for deliverect menu source", () => {
    expect(
      vendorRequiresDeliverectKitchenMapping({ menuSource: "deliverect" })
    ).toBe(true);
    expect(
      vendorRequiresDeliverectKitchenMapping({ menuSource: "open_order" })
    ).toBe(false);
  });

  it("allows open_order items without deliverectPlu", () => {
    expect(
      validateDeliverectProductKitchenMapping({
        vendor: { menuSource: "open_order" },
        deliverectPlu: null,
      }).ok
    ).toBe(true);
  });

  it("blocks deliverect items missing deliverectPlu", () => {
    const result = validateDeliverectProductKitchenMapping({
      vendor: { menuSource: "deliverect" },
      deliverectPlu: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DELIVERECT_PLU_MISSING");
  });

  it("allows open_order modifier options without deliverectModifierPlu", () => {
    expect(
      validateDeliverectModifierKitchenMapping({
        vendor: { menuSource: "open_order" },
        options: [{ deliverectModifierPlu: null }],
      }).ok
    ).toBe(true);
  });

  it("blocks deliverect modifier options missing deliverectModifierPlu", () => {
    const result = validateDeliverectModifierKitchenMapping({
      vendor: { menuSource: "deliverect" },
      options: [{ deliverectModifierPlu: "" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DELIVERECT_MODIFIER_PLU_MISSING");
  });

  it("uses mode-aware item messaging helper", () => {
    expect(
      deliverectItemKitchenMappingMessage({ menuSource: "open_order" })
    ).toBe(OPEN_ORDER_ITEM_NOT_ORDERABLE_MESSAGE);
    expect(
      deliverectItemKitchenMappingMessage({ menuSource: "deliverect" })
    ).toBe(DELIVERECT_ITEM_KITCHEN_MAPPING_MESSAGE);
  });

  it("applies deliverect subItems nesting only for deliverect menu source", () => {
    expect(vendorUsesDeliverectSubItemsNestingRules({ menuSource: "deliverect" })).toBe(
      true
    );
    expect(vendorUsesDeliverectSubItemsNestingRules({ menuSource: "open_order" })).toBe(
      false
    );
  });
});
