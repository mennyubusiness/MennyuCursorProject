import { describe, expect, it } from "vitest";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
  isVendorDeliverectLiveForUi,
  isVendorDeliverectPosConnected,
  isVendorPosManagedForUi,
  isVendorPosMenuManagedForUi,
  isVendorRoutingOperationalReady,
  isVendorSetupPosReady,
  vendorSetupPageIncompleteDescription,
  normalizeVendorOrderRoutingMode,
  vendorKitchenStatusLine,
  vendorKitchenStatusWarning,
  vendorMenuSyncLabelForRouting,
  vendorOrderRoutingModeAdminLabel,
  vendorOrderRoutingModeShortLabel,
  vendorRoutingSetupBlockerLabel,
  vendorRoutingStatusFieldLabel,
  vendorRoutingStatusLabel,
} from "./vendor-order-routing-mode";

describe("normalizeVendorOrderRoutingMode", () => {
  it("defaults unknown values to manual_dashboard", () => {
    expect(normalizeVendorOrderRoutingMode(null)).toBe("manual_dashboard");
    expect(normalizeVendorOrderRoutingMode(undefined)).toBe("manual_dashboard");
    expect(normalizeVendorOrderRoutingMode("other")).toBe("manual_dashboard");
  });

  it("preserves deliverect and square modes", () => {
    expect(normalizeVendorOrderRoutingMode("deliverect")).toBe("deliverect");
    expect(normalizeVendorOrderRoutingMode("square")).toBe("square");
  });
});

describe("routing mode labels", () => {
  it("uses admin and short labels per mode", () => {
    expect(vendorOrderRoutingModeAdminLabel("manual_dashboard")).toContain("Dashboard");
    expect(vendorOrderRoutingModeAdminLabel("deliverect")).toContain("Deliverect");
    expect(vendorOrderRoutingModeAdminLabel("square")).toContain("Square");
    expect(vendorOrderRoutingModeShortLabel("manual_dashboard")).toBe("Manual dashboard");
    expect(vendorOrderRoutingModeShortLabel("deliverect")).toBe("Deliverect");
    expect(vendorOrderRoutingModeShortLabel("square")).toBe("Square");
  });
});

describe("isVendorRoutingOperationalReady", () => {
  const connectedPos = {
    deliverectChannelLinkId: "link_1",
    posConnectionStatus: "connected" as const,
    deliverectAutoMapLastOutcome: null,
    pendingDeliverectConnectionKey: null,
  };

  it("passes for manual dashboard without Deliverect", () => {
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "manual_dashboard",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      })
    ).toBe(true);
    expect(isManualDashboardRoutingMode("manual_dashboard")).toBe(true);
    expect(isDeliverectRoutingMode("manual_dashboard")).toBe(false);
    expect(isSquareRoutingMode("manual_dashboard")).toBe(false);
  });

  it("requires Deliverect connection and mappings in deliverect mode", () => {
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "deliverect",
        deliverectMappingReady: true,
      })
    ).toBe(true);
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "deliverect",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      })
    ).toBe(false);
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "deliverect",
        deliverectMappingReady: false,
      })
    ).toBe(false);
  });

  it("square routing is ready when operational prerequisites pass", () => {
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "square",
        squareOrderRoutingReady: true,
      })
    ).toBe(true);
    expect(
      isVendorRoutingOperationalReady({
        ...connectedPos,
        orderRoutingMode: "square",
        squareOrderRoutingReady: false,
      })
    ).toBe(false);
    expect(
      vendorRoutingSetupBlockerLabel({
        orderRoutingMode: "square",
        squareConnectionReady: false,
      })
    ).toMatch(/Connect Square/i);
  });

  it("square setup checklist passes on connection only without admin injection enablement", () => {
    expect(
      isVendorSetupPosReady({
        ...connectedPos,
        orderRoutingMode: "square",
        squareConnectionReady: true,
        squareOrderRoutingEnabled: false,
      })
    ).toBe(true);
    expect(
      isVendorSetupPosReady({
        ...connectedPos,
        orderRoutingMode: "square",
        squareConnectionReady: false,
      })
    ).toBe(false);
  });

  it("manual dashboard setup does not require Square connection", () => {
    expect(
      isVendorSetupPosReady({
        ...connectedPos,
        orderRoutingMode: "manual_dashboard",
        squareConnectionReady: false,
      })
    ).toBe(true);
  });

  it("deliverect setup requires connected POS", () => {
    expect(
      isVendorSetupPosReady({
        ...connectedPos,
        orderRoutingMode: "deliverect",
      })
    ).toBe(true);
    expect(
      isVendorSetupPosReady({
        ...connectedPos,
        orderRoutingMode: "deliverect",
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
      })
    ).toBe(false);
  });

  it("uses provider-agnostic setup page description", () => {
    expect(vendorSetupPageIncompleteDescription("square")).toMatch(/public profile, menu, hours, payouts/i);
    expect(vendorSetupPageIncompleteDescription("square")).not.toMatch(/Square connection setup/i);
  });

  it("does not treat square as manual dashboard", () => {
    expect(isManualDashboardRoutingMode("square")).toBe(false);
  });
});

describe("vendor-facing routing UI helpers", () => {
  it("shows dashboard/tablet label instead of POS when manual_dashboard", () => {
    expect(vendorRoutingStatusLabel("manual_dashboard", "connected")).toContain("Dashboard");
    expect(vendorRoutingStatusFieldLabel("manual_dashboard")).toBe("Order routing");
    expect(isVendorPosManagedForUi("manual_dashboard", "connected")).toBe(false);
    expect(isVendorDeliverectLiveForUi("manual_dashboard", true)).toBe(false);
    expect(isVendorPosMenuManagedForUi("manual_dashboard", true)).toBe(false);
    expect(vendorKitchenStatusLine("manual_dashboard", "connected")).toContain("Open Order");
    expect(vendorKitchenStatusWarning("manual_dashboard", "not_connected")).toBeNull();
  });

  it("uses POS labels and managed flags when deliverect", () => {
    expect(vendorRoutingStatusLabel("deliverect", "connected")).toBe("POS connected");
    expect(vendorRoutingStatusFieldLabel("deliverect")).toBe("POS");
    expect(isVendorPosManagedForUi("deliverect", "connected")).toBe(true);
    expect(isVendorDeliverectLiveForUi("deliverect", true)).toBe(true);
    expect(isVendorPosMenuManagedForUi("deliverect", true)).toBe(true);
    expect(vendorMenuSyncLabelForRouting({
      orderRoutingMode: "deliverect",
      posConnected: true,
      menuReady: true,
      hasOperationalItems: true,
    })).toBe("Menu synced from POS");
    expect(vendorMenuSyncLabelForRouting({
      orderRoutingMode: "manual_dashboard",
      posConnected: true,
      menuReady: true,
      hasOperationalItems: true,
    })).toBe("Menu ready");
  });

  it("shows square-specific copy without treating it as deliverect", () => {
    expect(vendorRoutingStatusLabel("square", "connected")).toContain("Square");
    expect(isVendorPosManagedForUi("square", "connected")).toBe(false);
    expect(isVendorDeliverectLiveForUi("square", true)).toBe(false);
    expect(vendorKitchenStatusWarning("square", "connected")).toContain("not ready yet");
    expect(
      vendorKitchenStatusWarning("square", "connected", { squareInjectionOperational: true })
    ).toBeNull();
  });
});

describe("isVendorDeliverectPosConnected", () => {
  it("detects connected Deliverect POS state", () => {
    expect(
      isVendorDeliverectPosConnected({
        deliverectChannelLinkId: "link_1",
        posConnectionStatus: "connected",
        deliverectAutoMapLastOutcome: null,
        pendingDeliverectConnectionKey: null,
      })
    ).toBe(true);
    expect(
      isVendorDeliverectPosConnected({
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
        deliverectAutoMapLastOutcome: null,
        pendingDeliverectConnectionKey: null,
      })
    ).toBe(false);
  });
});
