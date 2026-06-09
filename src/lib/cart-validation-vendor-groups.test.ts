import { describe, expect, it } from "vitest";
import { buildCartValidationVendorGroups } from "./cart-validation-vendor-groups";
import type { Cart } from "@/domain/types";

const cart: Cart = {
  id: "cart_1",
  podId: "pod_1",
  sessionId: "sess_1",
  items: [
    {
      id: "line_a",
      menuItemId: "mi_a",
      vendorId: "v_bad",
      quantity: 1,
      priceCents: 500,
      menuItem: { name: "Burger" },
    },
    {
      id: "line_b",
      menuItemId: "mi_b",
      vendorId: "v_good",
      quantity: 1,
      priceCents: 300,
      menuItem: { name: "Fries" },
    },
  ],
  groups: [
    { vendorId: "v_bad", vendorName: "Bad Kitchen", items: [] },
    { vendorId: "v_good", vendorName: "Good Kitchen", items: [] },
  ],
  subtotalCents: 800,
};

describe("buildCartValidationVendorGroups", () => {
  it("groups errors by vendor without affecting unaffected vendors", () => {
    const groups = buildCartValidationVendorGroups(cart, [
      {
        code: "ITEM_UNAVAILABLE",
        message: "Burger is no longer available.",
        cartItemId: "line_a",
        menuItemId: "mi_a",
        menuItemName: "Burger",
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.vendorName).toBe("Bad Kitchen");
    expect(groups[0]?.issues).toHaveLength(1);
    expect(groups[0]?.issues[0]?.cartItemId).toBe("line_a");
  });
});
