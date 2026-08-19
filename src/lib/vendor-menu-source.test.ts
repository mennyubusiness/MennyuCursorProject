import { describe, expect, it } from "vitest";
import {
  activeMenuProviderForOrderRoutingMode,
  canonicalMenuSourceFromSnapshot,
  getVendorMenuSourceMismatchWarning,
  menuItemDeliverectIdMatchesMenuSource,
  menuItemMatchesActiveProvider,
  menuItemAllowedUnderCurrentAuthority,
  menuSourceForOrderRoutingMode,
  resolveActiveMenuSource,
  snapshotServesOpenOrderAuthority,
  snapshotIsNativeOpenOrderBuilder,
  vendorMenuSourceNavLabel,
} from "@/lib/vendor-menu-source";

describe("vendor-menu-source", () => {
  it("maps routing mode to menu source predictably", () => {
    expect(menuSourceForOrderRoutingMode("manual_dashboard")).toBe("open_order");
    expect(menuSourceForOrderRoutingMode("deliverect")).toBe("deliverect");
    expect(menuSourceForOrderRoutingMode("square")).toBe("open_order");
  });

  it("maps routing mode to a single active provider", () => {
    expect(activeMenuProviderForOrderRoutingMode("manual_dashboard")).toBe("open_order");
    expect(activeMenuProviderForOrderRoutingMode("deliverect")).toBe("deliverect");
    expect(activeMenuProviderForOrderRoutingMode("square")).toBe("square");
  });

  it("resolveActiveMenuSource prefers routing over stale persisted menuSource", () => {
    const resolved = resolveActiveMenuSource({
      orderRoutingMode: "manual_dashboard",
      menuSource: "deliverect",
    });
    expect(resolved.menuSource).toBe("open_order");
    expect(resolved.provider).toBe("open_order");
    expect(resolved.menuSourcePersisted).toBe("deliverect");
    expect(resolved.isAligned).toBe(false);
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
    expect(menuItemDeliverectIdMatchesMenuSource("del-123", "open_order")).toBe(true);
  });

  it("matches menu item product ids to active provider without merging Square and native", () => {
    expect(menuItemMatchesActiveProvider("oo:prod:abc", "open_order")).toBe(true);
    expect(menuItemMatchesActiveProvider("sq:prod:abc", "open_order")).toBe(false);
    expect(menuItemMatchesActiveProvider("sq:prod:abc", "square")).toBe(true);
    expect(menuItemMatchesActiveProvider("oo:prod:abc", "square")).toBe(false);
    expect(menuItemMatchesActiveProvider("del-123", "deliverect")).toBe(true);
    expect(menuItemMatchesActiveProvider("oo:prod:abc", "deliverect")).toBe(false);
  });

  it("Open Order menu authority accepts Square and Deliverect origin ids", () => {
    expect(menuItemAllowedUnderCurrentAuthority("sq:prod:abc", "open_order")).toBe(true);
    expect(menuItemAllowedUnderCurrentAuthority("del-123", "open_order")).toBe(true);
    expect(menuItemAllowedUnderCurrentAuthority("oo:prod:abc", "open_order")).toBe(true);
    expect(menuItemAllowedUnderCurrentAuthority("oo:prod:abc", "square")).toBe(false);
    expect(menuItemAllowedUnderCurrentAuthority("sq:prod:abc", "deliverect")).toBe(false);
  });

  it("treats Square and Deliverect snapshots as adoptable under Open Order authority", () => {
    const square = {
      schemaVersion: 1 as const,
      vendorId: "v1",
      categories: [],
      products: [],
      modifierGroupDefinitions: [],
      deliverect: { sourcePayloadKind: "square_catalog_v1" },
    };
    const deliverect = {
      ...square,
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    };
    const native = {
      ...square,
      deliverect: { sourcePayloadKind: "open_order_builder_v1" },
    };
    expect(snapshotServesOpenOrderAuthority(square)).toBe(true);
    expect(snapshotServesOpenOrderAuthority(deliverect)).toBe(true);
    expect(snapshotServesOpenOrderAuthority(native)).toBe(true);
    expect(snapshotIsNativeOpenOrderBuilder(square)).toBe(false);
    expect(snapshotIsNativeOpenOrderBuilder(native)).toBe(true);
  });
});
