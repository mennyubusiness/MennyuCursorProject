import { describe, expect, it } from "vitest";
import {
  adminDeliverectMenuPosSectionVisible,
  adminMenuManagementToolDescription,
  adminPosMappingToolVisible,
  adminRefreshMenuActionLabel,
  adminSquareInjectionDiagnosticsVisible,
  getProviderDisplayProfile,
  integratedOrderRoutingLabel,
  menuImportDraftReviewBanner,
  vendorKitchenModeNotice,
  vendorMenuImportsPageSubtitle,
  vendorMenuManagementPageSubtitle,
} from "@/lib/integrations/provider-display";

describe("provider display registry", () => {
  it("maps square routing to Square metadata with catalog import label", () => {
    const profile = getProviderDisplayProfile("square");
    expect(profile.displayName).toBe("Square");
    expect(profile.menuImportLabel).toBe("Square catalog import");
    expect(profile.catalogLabel).toBe("Square catalog");
  });

  it("maps deliverect routing to Deliverect metadata", () => {
    const profile = getProviderDisplayProfile("deliverect");
    expect(profile.displayName).toBe("Deliverect");
    expect(profile.menuImportLabel).toBe("Deliverect menu import");
  });

  it("maps manual routing without POS import requirements", () => {
    const profile = getProviderDisplayProfile("manual_dashboard");
    expect(profile.menuImportLabel).toBeNull();
    expect(profile.connectedLabel).toContain("dashboard");
  });

  it("uses provider-aware menu imports subtitles", () => {
    expect(vendorMenuImportsPageSubtitle("square")).toMatch(/imported menus/i);
    expect(vendorMenuImportsPageSubtitle("square")).not.toMatch(/Deliverect/i);
    expect(vendorMenuImportsPageSubtitle("deliverect")).toMatch(/Deliverect/i);
    expect(vendorMenuImportsPageSubtitle("deliverect")).not.toMatch(/Square catalog/i);
    expect(vendorMenuImportsPageSubtitle("manual_dashboard")).toMatch(/draft menus/i);
    expect(vendorMenuImportsPageSubtitle("manual_dashboard")).not.toMatch(/Deliverect|Square/i);
  });

  it("uses provider-aware admin menu management tool descriptions", () => {
    expect(adminMenuManagementToolDescription("square")).toMatch(/Square catalog/i);
    expect(adminMenuManagementToolDescription("deliverect")).toMatch(/Deliverect/i);
    expect(adminMenuManagementToolDescription("manual_dashboard")).not.toMatch(/Deliverect|Square/i);
  });

  it("shows provider-specific draft review banners", () => {
    expect(menuImportDraftReviewBanner("SQUARE_CATALOG_PULL", "Poke Sea")).toMatch(/Square catalog import/i);
    expect(menuImportDraftReviewBanner("DELIVERECT_API_PULL", "Poke Sea")).toMatch(/Deliverect menu import/i);
    expect(menuImportDraftReviewBanner("OTHER", "Poke Sea")).toMatch(/menu import is waiting/i);
  });

  it("shows square kitchen notice only for square vendors", () => {
    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "square",
        posState: "connected",
        squareInjectionOperational: true,
      })
    ).toMatch(/Square routing is enabled/i);

    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "square",
        posState: "connected",
        squareInjectionOperational: false,
      })
    ).toMatch(/order injection is not active/i);

    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "manual_dashboard",
        posState: "not_connected",
      })
    ).toBeNull();

    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "deliverect",
        posState: "connected",
      })
    ).toMatch(/Deliverect\/POS/i);
    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "deliverect",
        posState: "connected",
      })
    ).not.toMatch(/Square/i);
  });

  it("gates admin tools by routing mode", () => {
    expect(adminSquareInjectionDiagnosticsVisible("square")).toBe(true);
    expect(adminSquareInjectionDiagnosticsVisible("deliverect")).toBe(false);
    expect(adminPosMappingToolVisible("deliverect")).toBe(true);
    expect(adminPosMappingToolVisible("square")).toBe(false);
    expect(adminDeliverectMenuPosSectionVisible("deliverect")).toBe(true);
    expect(adminDeliverectMenuPosSectionVisible("square")).toBe(false);
  });

  it("uses provider-aware admin refresh menu labels", () => {
    expect(adminRefreshMenuActionLabel("deliverect")).toMatch(/Deliverect/i);
    expect(adminRefreshMenuActionLabel("square")).toMatch(/Square/i);
    expect(adminRefreshMenuActionLabel("manual_dashboard")).toBe("Refresh menu");
  });

  it("integratedOrderRoutingLabel delegates to profile shortName", () => {
    expect(integratedOrderRoutingLabel("square")).toBe("Square");
    expect(integratedOrderRoutingLabel("deliverect")).toBe("Deliverect");
    expect(integratedOrderRoutingLabel("manual_dashboard")).toBe("Dashboard");
  });

  it("vendor menu management subtitle is provider-specific", () => {
    expect(vendorMenuManagementPageSubtitle("square", "Poke Sea")).toMatch(/imported menus/i);
    expect(vendorMenuManagementPageSubtitle("square", "Poke Sea")).not.toMatch(/Deliverect/i);
    expect(vendorMenuManagementPageSubtitle("deliverect", "Poke Sea")).toMatch(/Deliverect/i);
  });
});
