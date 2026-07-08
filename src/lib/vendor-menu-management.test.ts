import { describe, expect, it } from "vitest";
import {
  getVendorMenuManagementMode,
  usesVendorMenuBuilder,
  vendorMenuManagementModeLabel,
  vendorMenuManagementNavLabel,
  vendorMenuManagementPath,
} from "@/lib/vendor-menu-management";

describe("vendor-menu-management", () => {
  it("maps manual_dashboard to builder", () => {
    expect(getVendorMenuManagementMode("manual_dashboard")).toBe("builder");
    expect(usesVendorMenuBuilder("manual_dashboard")).toBe(true);
    expect(vendorMenuManagementNavLabel("manual_dashboard")).toBe("Menu Builder");
    expect(vendorMenuManagementPath("v1", "manual_dashboard")).toBe("/vendor/v1/menu-builder");
  });

  it("maps deliverect to imports regardless of menuSource", () => {
    expect(getVendorMenuManagementMode("deliverect")).toBe("imports");
    expect(usesVendorMenuBuilder("deliverect")).toBe(false);
    expect(vendorMenuManagementNavLabel("deliverect")).toBe("Menu Imports");
    expect(vendorMenuManagementPath("v1", "deliverect")).toBe("/vendor/v1/menu/imports");
  });

  it("maps square to imports even when menuSource remains open_order", () => {
    expect(getVendorMenuManagementMode("square")).toBe("imports");
    expect(usesVendorMenuBuilder("square")).toBe(false);
    expect(vendorMenuManagementNavLabel("square")).toBe("Menu Imports");
    expect(vendorMenuManagementPath("v1", "square")).toBe("/vendor/v1/menu/imports");
  });

  it("labels management mode for admin display", () => {
    expect(vendorMenuManagementModeLabel("builder")).toBe("Builder");
    expect(vendorMenuManagementModeLabel("imports")).toBe("Imports");
  });
});
