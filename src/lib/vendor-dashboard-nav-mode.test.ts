import { describe, expect, it } from "vitest";

import {
  DEFAULT_VENDOR_DASHBOARD_NAV_MODE,
  isVendorNavHrefVisible,
  vendorNavShowsKitchen,
  vendorShowsCommerceSetup,
  type VendorDashboardNavMode,
} from "@/lib/vendor-dashboard-nav-mode";

function mode(overrides?: Partial<VendorDashboardNavMode>): VendorDashboardNavMode {
  return { ...DEFAULT_VENDOR_DASHBOARD_NAV_MODE, ...overrides };
}

describe("vendor dashboard nav in menu-only mode", () => {
  it("keeps every nav link when ordering is enabled", () => {
    for (const href of ["", "menu", "hours", "orders", "payouts", "settings", "setup"]) {
      expect(isVendorNavHrefVisible(href, mode())).toBe(true);
    }
    expect(vendorNavShowsKitchen(mode())).toBe(true);
    expect(vendorShowsCommerceSetup(mode())).toBe(true);
  });

  it("hides payouts and kitchen for a menu-only vendor with no orders", () => {
    const menuOnly = mode({ menuOnly: true });
    expect(isVendorNavHrefVisible("payouts", menuOnly)).toBe(false);
    expect(isVendorNavHrefVisible("orders", menuOnly)).toBe(false);
    expect(vendorNavShowsKitchen(menuOnly)).toBe(false);
    expect(vendorShowsCommerceSetup(menuOnly)).toBe(false);
  });

  it("keeps menu, hours, profile, and setup for a menu-only vendor", () => {
    const menuOnly = mode({ menuOnly: true });
    for (const href of ["", "menu", "hours", "settings", "setup"]) {
      expect(isVendorNavHrefVisible(href, menuOnly)).toBe(true);
    }
  });

  /** A ticket the vendor still owes a customer outranks the menu-only simplification. */
  it("keeps kitchen and orders while an order is still in flight", () => {
    const inFlight = mode({ menuOnly: true, hasActiveOrders: true, hasOrderHistory: true });
    expect(vendorNavShowsKitchen(inFlight)).toBe(true);
    expect(isVendorNavHrefVisible("orders", inFlight)).toBe(true);
  });

  it("keeps order history reachable after ordering is turned off", () => {
    const pastOrders = mode({ menuOnly: true, hasActiveOrders: false, hasOrderHistory: true });
    expect(isVendorNavHrefVisible("orders", pastOrders)).toBe(true);
    expect(vendorNavShowsKitchen(pastOrders)).toBe(false);
  });

  it("restores the full nav automatically when ordering is re-enabled", () => {
    const reEnabled = mode({ menuOnly: false, hasOrderHistory: true });
    expect(isVendorNavHrefVisible("payouts", reEnabled)).toBe(true);
    expect(vendorNavShowsKitchen(reEnabled)).toBe(true);
    expect(vendorShowsCommerceSetup(reEnabled)).toBe(true);
  });
});
