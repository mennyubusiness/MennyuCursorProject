import { describe, expect, it } from "vitest";
import {
  canonicalMenuSourceFromSnapshot,
  getVendorMenuSourceMismatchWarning,
  menuItemDeliverectIdMatchesMenuSource,
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

  it("detects canonical menu source from snapshot", () => {
    const base = {
      schemaVersion: 1 as const,
      vendorId: "v1",
      categories: [],
      products: [],
      modifierGroupDefinitions: [],
    };
    expect(
      canonicalMenuSourceFromSnapshot({
        ...base,
        deliverect: { sourcePayloadKind: "open_order_builder_v1" },
      })
    ).toBe("open_order");
    expect(
      canonicalMenuSourceFromSnapshot({
        ...base,
        deliverect: { sourcePayloadKind: "square_catalog_v1" },
      })
    ).toBe("open_order");
    expect(
      canonicalMenuSourceFromSnapshot({
        ...base,
        deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
      })
    ).toBe("deliverect");
  });

  it("matches menu item product ids to menu source", () => {
    expect(menuItemDeliverectIdMatchesMenuSource("oo:prod:abc", "open_order")).toBe(true);
    expect(menuItemDeliverectIdMatchesMenuSource("sq:prod:abc", "open_order")).toBe(true);
    expect(menuItemDeliverectIdMatchesMenuSource("oo:prod:abc", "deliverect")).toBe(false);
    expect(menuItemDeliverectIdMatchesMenuSource("sq:prod:abc", "deliverect")).toBe(false);
    expect(menuItemDeliverectIdMatchesMenuSource("del-123", "deliverect")).toBe(true);
    expect(menuItemDeliverectIdMatchesMenuSource("del-123", "open_order")).toBe(false);
  });
});
