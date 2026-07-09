import { describe, expect, it } from "vitest";
import {
  adminDeliverectMenuPosSectionVisible,
  adminActiveRoutingStatusMessage,
  adminInactiveSquareDiagnosticsVisible,
  adminMenuManagementToolDescription,
  adminPosMappingToolVisible,
  adminRefreshMenuActionLabel,
  adminShowSquareRoutingStatusPrimary,
  adminSquareInjectionDiagnosticsVisible,
  adminVendorMenuStatusLabel,
  adminVendorOverviewMenuSourceLabel,
  adminVendorOverviewRoutingProviderLabel,
  ADMIN_ORDER_ROUTING_GENERIC_COPY,
  formatAdminDownstreamPosProvider,
  getAdminVendorDetailTools,
  getProviderDisplayProfile,
  integratedOrderRoutingLabel,
  menuImportDraftReviewBanner,
  vendorKitchenModeNotice,
  vendorKitchenPageTitle,
  vendorKitchenPageHelper,
  vendorKitchenCtaLabel,
  vendorKitchenNavLabel,
  vendorKitchenInlineLinkLabel,
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

  it("shows square kitchen notice only for square vendors that are not ready", () => {
    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "square",
        posState: "connected",
        squareInjectionOperational: true,
      })
    ).toBeNull();

    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "square",
        posState: "connected",
        squareInjectionOperational: false,
      })
    ).toMatch(/not ready yet/i);

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
    ).toBeNull();

    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "deliverect",
        posState: "needs_attention",
      })
    ).toMatch(/Deliverect needs attention/i);
    expect(
      vendorKitchenModeNotice({
        orderRoutingMode: "deliverect",
        posState: "needs_attention",
      })
    ).not.toMatch(/Square/i);
  });

  it("labels kitchen page as orders monitor for integrated vendors", () => {
    expect(vendorKitchenPageTitle("square")).toBe("Orders monitor");
    expect(vendorKitchenPageTitle("deliverect")).toBe("Orders monitor");
    expect(vendorKitchenPageTitle("manual_dashboard")).toBe("Kitchen Mode");
    expect(vendorKitchenPageHelper("square")).toBe("Manage order status in Square.");
    expect(vendorKitchenPageHelper("deliverect")).toBe("Manage order status in Deliverect.");
    expect(vendorKitchenPageHelper("manual_dashboard")).toBeNull();
    expect(vendorKitchenCtaLabel("square")).toBe("View orders monitor");
    expect(vendorKitchenCtaLabel("manual_dashboard")).toBe("Open kitchen mode");
    expect(vendorKitchenNavLabel("square")).toBe("Orders monitor");
    expect(vendorKitchenNavLabel("deliverect")).toBe("Orders monitor");
    expect(vendorKitchenNavLabel("manual_dashboard")).toBe("Kitchen");
    expect(vendorKitchenInlineLinkLabel("square")).toBe("Orders monitor");
    expect(vendorKitchenInlineLinkLabel("manual_dashboard")).toBe("Kitchen Mode");
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

  it("uses consistent admin overview labels by routing mode", () => {
    expect(adminVendorOverviewRoutingProviderLabel("deliverect")).toBe("Deliverect");
    expect(adminVendorOverviewRoutingProviderLabel("square")).toBe("Square");
    expect(adminVendorOverviewRoutingProviderLabel("manual_dashboard")).toBe("Open Order Dashboard");

    expect(
      adminVendorOverviewMenuSourceLabel({
        orderRoutingMode: "deliverect",
        menuSource: "deliverect",
      })
    ).toBe("Deliverect sync");
    expect(
      adminVendorOverviewMenuSourceLabel({
        orderRoutingMode: "square",
        menuSource: "open_order",
      })
    ).toBe("Square catalog import");
    expect(
      adminVendorOverviewMenuSourceLabel({
        orderRoutingMode: "manual_dashboard",
        menuSource: "open_order",
      })
    ).toBe("Open Order menu builder");
  });

  it("derives admin menu status from publish and draft state", () => {
    expect(
      adminVendorMenuStatusLabel({
        hasPublishedMenu: true,
        hasDraftAwaitingReview: false,
        totalItems: 10,
      })
    ).toBe("Published");
    expect(
      adminVendorMenuStatusLabel({
        hasPublishedMenu: true,
        hasDraftAwaitingReview: true,
        totalItems: 10,
      })
    ).toBe("Draft available");
    expect(
      adminVendorMenuStatusLabel({
        hasPublishedMenu: false,
        hasDraftAwaitingReview: false,
        totalItems: 0,
      })
    ).toBe("Missing");
  });

  it("labels downstream POS for Deliverect without implying active routing", () => {
    expect(formatAdminDownstreamPosProvider("toast")).toBe("Toast");
    expect(formatAdminDownstreamPosProvider(null)).toBeNull();
  });

  it("gates Square routing status to Square saved or selected modes", () => {
    expect(
      adminShowSquareRoutingStatusPrimary({
        savedMode: "deliverect",
        selectedMode: "deliverect",
      })
    ).toBe(false);
    expect(
      adminShowSquareRoutingStatusPrimary({
        savedMode: "deliverect",
        selectedMode: "square",
      })
    ).toBe(true);
    expect(
      adminShowSquareRoutingStatusPrimary({
        savedMode: "square",
        selectedMode: "square",
      })
    ).toBe(true);
  });

  it("shows inactive Square diagnostics only when not active routing but connected", () => {
    expect(
      adminInactiveSquareDiagnosticsVisible({
        savedMode: "deliverect",
        hasSquareConnection: true,
      })
    ).toBe(true);
    expect(
      adminInactiveSquareDiagnosticsVisible({
        savedMode: "deliverect",
        hasSquareConnection: false,
      })
    ).toBe(false);
    expect(
      adminInactiveSquareDiagnosticsVisible({
        savedMode: "square",
        hasSquareConnection: true,
      })
    ).toBe(false);
  });

  it("uses provider-agnostic order routing copy without Square mention", () => {
    expect(ADMIN_ORDER_ROUTING_GENERIC_COPY).toMatch(/managed separately/i);
    expect(ADMIN_ORDER_ROUTING_GENERIC_COPY).not.toMatch(/Square/i);
  });

  it("filters admin vendor detail tools by routing mode", () => {
    const deliverectTools = getAdminVendorDetailTools("v1", "deliverect");
    expect(deliverectTools.some((t) => t.title.match(/Deliverect menu imports/i))).toBe(true);
    expect(deliverectTools.some((t) => t.title.match(/Square injection/i))).toBe(false);

    const squareTools = getAdminVendorDetailTools("v1", "square");
    expect(squareTools.some((t) => t.title.match(/Square injection debug/i))).toBe(true);
    expect(squareTools.some((t) => t.title.match(/Deliverect POS/i))).toBe(false);

    const manualTools = getAdminVendorDetailTools("v1", "manual_dashboard");
    expect(manualTools.some((t) => t.title.match(/Menu builder/i))).toBe(true);
    expect(manualTools.some((t) => t.title.match(/Square|Deliverect/i))).toBe(false);
  });

  it("active routing status message is provider-specific", () => {
    expect(
      adminActiveRoutingStatusMessage({
        orderRoutingMode: "deliverect",
        deliverectConnected: true,
        posConnectionStatus: "connected",
        squareStatusMessage: "Square is not ready...",
        squareConnectionStatus: null,
      }).message
    ).toMatch(/Deliverect is connected/i);
    expect(
      adminActiveRoutingStatusMessage({
        orderRoutingMode: "deliverect",
        deliverectConnected: true,
        posConnectionStatus: "connected",
        squareStatusMessage: "Square is not ready...",
        squareConnectionStatus: null,
      }).message
    ).not.toMatch(/Square is not ready/i);

    expect(
      adminActiveRoutingStatusMessage({
        orderRoutingMode: "manual_dashboard",
        deliverectConnected: false,
        posConnectionStatus: null,
        squareStatusMessage: "Square is not ready...",
        squareConnectionStatus: null,
      }).message
    ).toMatch(/Open Order Dashboard routing is active/i);
  });
});
