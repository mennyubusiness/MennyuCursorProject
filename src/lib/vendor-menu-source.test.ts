import { describe, expect, it } from "vitest";
import {
  getVendorMenuSourceMismatchWarning,
  menuSourceForOrderRoutingMode,
  vendorMenuSourceNavLabel,
} from "@/lib/vendor-menu-source";

describe("vendor-menu-source", () => {
  it("maps routing mode to menu source predictably", () => {
    expect(menuSourceForOrderRoutingMode("manual_dashboard")).toBe("open_order");
    expect(menuSourceForOrderRoutingMode("deliverect")).toBe("deliverect");
  });

  it("labels nav by menu source", () => {
    expect(vendorMenuSourceNavLabel("open_order")).toBe("Menu Builder");
    expect(vendorMenuSourceNavLabel("deliverect")).toBe("POS Menu Sync");
  });

  it("warns when manual routing uses deliverect menu source", () => {
    const warning = getVendorMenuSourceMismatchWarning({
      menuSource: "deliverect",
      orderRoutingMode: "manual_dashboard",
    });
    expect(warning?.headline).toBe("Menu source mismatch");
    expect(warning?.detail).toMatch(/routes orders manually/i);
  });

  it("returns null when routing and menu source align", () => {
    expect(
      getVendorMenuSourceMismatchWarning({
        menuSource: "open_order",
        orderRoutingMode: "manual_dashboard",
      })
    ).toBeNull();
  });
});
