import { describe, expect, it } from "vitest";

import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import {
  buildRoleAccountActions,
  buildRoleNavConfig,
  resolvePrimaryNavModeFromMemberships,
  shouldShowHeaderCart,
} from "@/lib/auth/role-nav-items";

const baseAccountMenu: HeaderAccountMenu = {
  email: "vendor@example.com",
  name: "Vendor User",
  roleHint: "Vendor",
  adminDashboardHref: null,
  vendorDashboardHref: "/vendor/v1",
  vendorDashboardLabel: "Taco Cart",
  podDashboardHref: null,
  podDashboardLabel: null,
  primaryVendorId: "v1",
  primaryPodId: null,
  vendorSelectHref: null,
  podSelectHref: null,
  vendorOrdersHref: "/vendor/v1/orders",
  vendorKitchenHref: "/vendor/v1/kitchen",
  vendorSettingsHref: "/vendor/v1/settings",
  podSettingsHref: null,
  podVendorsHref: null,
};

describe("resolvePrimaryNavModeFromMemberships", () => {
  it("prioritizes admin over vendor and pod", () => {
    expect(
      resolvePrimaryNavModeFromMemberships({
        isPlatformAdmin: true,
        vendorCount: 1,
        podCount: 1,
      })
    ).toBe("admin");
  });

  it("prioritizes vendor over pod and customer", () => {
    expect(
      resolvePrimaryNavModeFromMemberships({
        isPlatformAdmin: false,
        vendorCount: 1,
        podCount: 1,
      })
    ).toBe("vendor");
  });
});

describe("shouldShowHeaderCart", () => {
  it("shows cart for customer mode and guest carts, not operational roles", () => {
    expect(shouldShowHeaderCart({ navMode: "customer", hasActiveCart: false })).toBe(true);
    expect(shouldShowHeaderCart({ navMode: "guest", hasActiveCart: true })).toBe(true);
    expect(shouldShowHeaderCart({ navMode: "guest", hasActiveCart: false })).toBe(false);
    expect(shouldShowHeaderCart({ navMode: "vendor", hasActiveCart: true })).toBe(false);
    expect(shouldShowHeaderCart({ navMode: "pod", hasActiveCart: true })).toBe(false);
  });
});

describe("buildRoleNavConfig", () => {
  it("shows explore and business CTA for guests only", () => {
    const guest = buildRoleNavConfig({ mode: "guest", accountMenu: null, dashboardHref: null });
    expect(guest.headerLinks).toEqual([{ href: "/explore", label: "Explore" }]);
    expect(guest.showBusinessCta).toBe(true);
    expect(guest.showCartForSession).toBe(false);
  });

  it("shows explore and cart for customers without business CTA", () => {
    const customer = buildRoleNavConfig({
      mode: "customer",
      accountMenu: { ...baseAccountMenu, roleHint: null },
      dashboardHref: null,
    });
    expect(customer.headerLinks).toEqual([{ href: "/explore", label: "Explore" }]);
    expect(customer.showBusinessCta).toBe(false);
    expect(customer.showCartForSession).toBe(true);
    expect(customer.accountActions.some((a) => a.type === "link" && a.label === "Orders")).toBe(
      true
    );
  });

  it("shows vendor dashboard and kitchen links for vendor users", () => {
    const vendor = buildRoleNavConfig({
      mode: "vendor",
      accountMenu: baseAccountMenu,
      dashboardHref: "/vendor/v1",
    });
    expect(vendor.headerLinks).toEqual([
      { href: "/vendor/v1", label: "Vendor dashboard" },
      { href: "/vendor/v1/kitchen", label: "Kitchen mode" },
    ]);
    expect(vendor.showBusinessCta).toBe(false);
    expect(vendor.showCartForSession).toBe(false);
  });
});

describe("buildRoleAccountActions", () => {
  it("omits customer order history for vendor primary mode", () => {
    const actions = buildRoleAccountActions({
      mode: "vendor",
      accountMenu: baseAccountMenu,
      dashboardHref: "/vendor/v1",
    });
    expect(actions.some((a) => a.type === "link" && a.href === "/orders")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Kitchen mode")).toBe(true);
  });

  it("includes customer orders for customer mode", () => {
    const actions = buildRoleAccountActions({
      mode: "customer",
      accountMenu: { ...baseAccountMenu, roleHint: null },
      dashboardHref: null,
    });
    expect(actions.some((a) => a.type === "link" && a.label === "Orders")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.label === "Kitchen mode")).toBe(false);
  });
});
