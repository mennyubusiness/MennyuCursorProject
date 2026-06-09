import { describe, expect, it } from "vitest";
import { buildCartForValidationFromDisplayCart } from "./cart-for-validation";

describe("buildCartForValidationFromDisplayCart posOpen", () => {
  it("does not pass posOpen until Vendor stores open/closed state", () => {
    const built = buildCartForValidationFromDisplayCart({
      podId: "pod_1",
      items: [
        {
          id: "line_1",
          menuItemId: "mi_1",
          vendorId: "v_1",
          quantity: 1,
          priceCents: 500,
          menuItem: {
            priceCents: 500,
            isAvailable: true,
            name: "Burger",
          },
          vendor: {
            isActive: true,
            mennyuOrdersPaused: false,
            posOpen: false,
          },
        },
      ],
    });
    expect(built.items[0]?.vendor.posOpen).toBeUndefined();
  });
});
