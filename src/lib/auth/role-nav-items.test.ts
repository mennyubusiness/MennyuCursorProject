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
  vendorPublicPageHref: "/willamette-garage/taco-cart",
  podPublicPageHref: "/riverside-pod",
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
  it("shows business CTA for guests only", () => {
    const guest = buildRoleNavConfig({ mode: "guest", accountMenu: null, dashboardHref: null });
    expect(guest.showBusinessCta).toBe(true);
    expect(guest.showCartForSession).toBe(false);
    expect(guest.accountActions).toEqual([]);
  });

  it("shows cart for customers without business CTA", () => {
    const customer = buildRoleNavConfig({
      mode: "customer",
      accountMenu: { ...baseAccountMenu, roleHint: null },
      dashboardHref: null,
    });
    expect(customer.showBusinessCta).toBe(false);
    expect(customer.showCartForSession).toBe(true);
    expect(customer.accountActions.some((a) => a.type === "link" && a.label === "Orders")).toBe(
      true
    );
  });

  it("does not expose separate header link arrays", () => {
    const vendor = buildRoleNavConfig({
      mode: "vendor",
      accountMenu: baseAccountMenu,
      dashboardHref: "/vendor/v1",
    });
    expect(vendor).not.toHaveProperty("headerLinks");
    expect(vendor.accountActions.map((a) => (a.type === "link" ? a.label : a.label))).toEqual([
      "Account",
      "Dashboard",
      "Public page",
      "Sign out",
    ]);
  });
});

describe("buildRoleAccountActions", () => {
  it("shows a compact vendor menu without operational shortcuts", () => {
    const actions = buildRoleAccountActions({
      mode: "vendor",
      accountMenu: baseAccountMenu,
      dashboardHref: "/vendor/v1",
    });
    expect(actions.some((a) => a.type === "link" && a.href === "/orders")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Kitchen mode")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Settings")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Vendor account")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Account")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.label === "Dashboard")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.href === "/vendor/v1/dashboard")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.label === "Public page")).toBe(true);
    expect(actions.some((a) => a.type === "sign-out")).toBe(true);
  });

  it("omits public page when vendor has no customer-facing URL", () => {
    const actions = buildRoleAccountActions({
      mode: "vendor",
      accountMenu: { ...baseAccountMenu, vendorPublicPageHref: null },
      dashboardHref: "/vendor/v1",
    });
    expect(actions.some((a) => a.type === "link" && a.label === "Public page")).toBe(false);
  });

  it("shows a compact pod menu without operational shortcuts", () => {
    const actions = buildRoleAccountActions({
      mode: "pod",
      accountMenu: {
        ...baseAccountMenu,
        roleHint: "Pod",
        primaryPodId: "pod_1",
        podPublicPageHref: "/riverside-pod",
        podSelectHref: null,
      },
      dashboardHref: "/pod/pod_1/dashboard",
    });
    expect(actions.some((a) => a.type === "link" && a.label === "Pod settings")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Manage vendors")).toBe(false);
    expect(actions.some((a) => a.type === "link" && a.label === "Account")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.label === "Dashboard")).toBe(true);
    expect(actions.some((a) => a.type === "link" && a.label === "Public page")).toBe(true);
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
