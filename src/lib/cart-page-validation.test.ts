import { describe, expect, it } from "vitest";
import {
  buildErrorByCartItemId,
  cartMutationFingerprint,
  deriveCartPageCheckoutState,
  pruneValidationForCart,
  type CartPageValidationSnapshot,
} from "@/lib/cart-page-validation";

const invalid: CartPageValidationSnapshot = {
  valid: false,
  errors: [
    {
      code: "ITEM_UNAVAILABLE",
      message: "Burger is no longer available.",
      cartItemId: "line_abc",
      menuItemId: "mi_burger",
      menuItemName: "Burger",
    },
    {
      code: "ITEM_UNAVAILABLE",
      message: "Fries are no longer available.",
      cartItemId: "line_def",
      menuItemId: "mi_fries",
      menuItemName: "Fries",
    },
  ],
};

describe("cart-page-validation", () => {
  it("blocks continue when cart has unavailable item", () => {
    const state = deriveCartPageCheckoutState({
      cartItemCount: 2,
      validation: invalid,
    });
    expect(state.canCheckout).toBe(false);
    expect(state.showWarning).toBe(true);
  });

  it("clears warning and enables continue after removing unavailable item", () => {
    const remaining = [{ id: "line_ok", menuItemId: "mi_cola" }];
    const pruned = pruneValidationForCart(invalid, remaining);
    const state = deriveCartPageCheckoutState({
      cartItemCount: 1,
      validation: pruned,
    });
    expect(pruned.errors).toEqual([]);
    expect(pruned.valid).toBe(true);
    expect(state.showWarning).toBe(false);
    expect(state.canCheckout).toBe(true);
  });

  it("still blocks when one invalid item remains after partial removal", () => {
    const pruned = pruneValidationForCart(invalid, [
      { id: "line_abc", menuItemId: "mi_burger" },
      { id: "line_ok", menuItemId: "mi_cola" },
    ]);
    const state = deriveCartPageCheckoutState({
      cartItemCount: 2,
      validation: pruned,
    });
    expect(pruned.errors).toHaveLength(1);
    expect(pruned.errors[0]?.cartItemId).toBe("line_abc");
    expect(state.canCheckout).toBe(false);
    expect(state.showWarning).toBe(true);
  });

  it("prunes menuItemId-only errors when no matching lines remain", () => {
    const validation: CartPageValidationSnapshot = {
      valid: false,
      errors: [
        {
          code: "ITEM_UNAVAILABLE",
          message: "Combo is unavailable.",
          menuItemId: "mi_combo",
        },
      ],
    };
    const pruned = pruneValidationForCart(validation, [{ id: "line_ok", menuItemId: "mi_cola" }]);
    expect(pruned.errors).toEqual([]);
    expect(pruned.valid).toBe(true);
  });

  it("buildErrorByCartItemId maps menuItemId errors onto remaining lines", () => {
    const errors = [
      {
        code: "PRICE_CHANGED",
        message: "Price changed.",
        menuItemId: "mi_cola",
      },
    ];
    const map = buildErrorByCartItemId(errors, [{ id: "line_ok", menuItemId: "mi_cola" }]);
    expect(map.get("line_ok")).toBe("Price changed.");
  });

  it("returns empty cart state without warning", () => {
    const state = deriveCartPageCheckoutState({
      cartItemCount: 0,
      validation: { valid: true, errors: [] },
    });
    expect(state.canCheckout).toBe(false);
    expect(state.showWarning).toBe(false);
  });

  it("cartMutationFingerprint changes on quantity edits", () => {
    const base = [{ id: "line_1", menuItemId: "mi_1", quantity: 1, priceCents: 500 }];
    const updated = [{ id: "line_1", menuItemId: "mi_1", quantity: 2, priceCents: 500 }];
    expect(cartMutationFingerprint(base)).not.toBe(cartMutationFingerprint(updated));
  });
});
