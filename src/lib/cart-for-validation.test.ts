import { describe, expect, it } from "vitest";
import { defaultVendorCustomerOrderingWeek } from "./vendor-customer-ordering-hours";
import { buildCartForValidationFromDisplayCart } from "./cart-for-validation";

describe("buildCartForValidationFromDisplayCart posOpen", () => {
  it("blocks orderability when no manual customer ordering hours are configured", () => {
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
          },
        },
      ],
    });
    expect(built.items[0]?.vendor.posOpen).toBe(false);
  });

  it("derives posOpen from custom customer ordering hours", () => {
    const built = buildCartForValidationFromDisplayCart({
      podId: "pod_1",
      pod: { pickupTimezone: "America/Chicago" },
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
            syncCustomerOrderingHoursFromDeliverect: false,
            customerOrderingHours: defaultVendorCustomerOrderingWeek(),
          },
        },
      ],
    });
    expect(typeof built.items[0]?.vendor.posOpen).toBe("boolean");
  });

  it("blocks orderability when manual hours are missing even if Deliverect sync flag is on", () => {
    const built = buildCartForValidationFromDisplayCart({
      podId: "pod_1",
      pod: { pickupTimezone: "America/Chicago" },
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
            syncCustomerOrderingHoursFromDeliverect: true,
            customerOrderingHours: defaultVendorCustomerOrderingWeek(),
            deliverectSyncedCustomerOrderingHours: null,
          },
        },
      ],
    });
    expect(built.items[0]?.vendor.posOpen).toBe(false);
  });
});
