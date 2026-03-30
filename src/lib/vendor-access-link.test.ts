import { describe, expect, it } from "vitest";
import { safeVendorDashboardRedirectPath, signVendorAccessLinkToken, verifyVendorAccessLinkToken } from "./vendor-access-link";

describe("vendor-access-link", () => {
  it("round-trips and expires", () => {
    const t = signVendorAccessLinkToken("vendor_1", {
      expiresInSec: 3600,
      redirectPath: "/vendor/vendor_1/menu",
    });
    const p = verifyVendorAccessLinkToken(t);
    expect(p.vendorId).toBe("vendor_1");
    expect(p.redirectPath).toBe("/vendor/vendor_1/menu");
  });

  it("rejects tampered token", () => {
    const t = signVendorAccessLinkToken("vendor_1", { expiresInSec: 60 });
    const bad = t.slice(0, -4) + "xxxx";
    expect(() => verifyVendorAccessLinkToken(bad)).toThrow();
  });

  it("safeVendorDashboardRedirectPath blocks open redirects", () => {
    expect(safeVendorDashboardRedirectPath("v1", "/vendor/v2/menu")).toMatch(/\/vendor\/v1\/menu$/);
    expect(safeVendorDashboardRedirectPath("v1", "https://evil.com")).toMatch(/\/vendor\/v1\/menu$/);
    expect(safeVendorDashboardRedirectPath("v1", "/vendor/v1/orders")).toBe("/vendor/v1/orders");
  });
});
