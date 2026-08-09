import { describe, expect, it } from "vitest";
import {
  assertVendorPosRoutingConfigurationAllowed,
  getAdminAvailableRoutingModes,
  getVendorAvailableRoutingModes,
  isVendorPosRoutingSelectionEnabled,
  isVendorSelectableRoutingMode,
  vendorMayConfigurePosOrderRouting,
} from "@/lib/vendor-routing-availability";

describe("vendor routing availability (beta tablet-only)", () => {
  it("disables vendor POS routing selection", () => {
    expect(isVendorPosRoutingSelectionEnabled()).toBe(false);
    expect(vendorMayConfigurePosOrderRouting()).toBe(false);
  });

  it("exposes only manual_dashboard to vendors", () => {
    expect(getVendorAvailableRoutingModes()).toEqual(["manual_dashboard"]);
    expect(isVendorSelectableRoutingMode("manual_dashboard")).toBe(true);
    expect(isVendorSelectableRoutingMode("deliverect")).toBe(false);
    expect(isVendorSelectableRoutingMode("square")).toBe(false);
  });

  it("keeps full routing modes available to admins", () => {
    expect(getAdminAvailableRoutingModes()).toEqual([
      "manual_dashboard",
      "deliverect",
      "square",
    ]);
  });

  it("rejects vendor POS configuration mutations", () => {
    const gate = assertVendorPosRoutingConfigurationAllowed();
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.error).toMatch(/Open Order dashboard/i);
    }
  });
});
