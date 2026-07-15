import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFind = vi.fn();
const mockReadiness = vi.fn();
const mockConnection = vi.fn();
const mockHealth = vi.fn();
const mockSquareConfig = vi.fn();
const mockMapping = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: (...args: unknown[]) => mockVendorFind(...args) },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENABLE_SQUARE_INTEGRATION: "true",
    SQUARE_ROUTING_LIVE: "true",
  },
}));

vi.mock("@/lib/integrations/square/square-config", () => ({
  getSquareConfigSnapshot: (...args: unknown[]) => mockSquareConfig(...args),
}));

vi.mock("@/lib/integrations/square/square-order-routing-readiness", () => ({
  loadSquareOrderRoutingReadiness: (...args: unknown[]) => mockReadiness(...args),
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockConnection(...args),
  evaluateSquareConnectionHealth: (...args: unknown[]) => mockHealth(...args),
}));

vi.mock("@/lib/integrations/square/square-mapping-diagnostics.server", () => ({
  loadSquareVendorMappingDiagnostics: (...args: unknown[]) => mockMapping(...args),
}));

import {
  loadAdminSquareEnvDiagnostics,
  loadAdminSquareOrderInjectionDiagnostics,
} from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";

const VENDOR_ID = "vendor_sq";

const mappingFixture = {
  vendorId: VENDOR_ID,
  vendorName: "Poke Sea",
  orderRoutingMode: "square",
  activeSquareConnectionId: "conn_1",
  externalMerchantId: "MERCH_1",
  externalLocationId: "LOC_1",
  connectionStatus: "connected",
  credentialRefPresent: true,
  activeSquareConnectionCount: 1,
  squareConnections: [],
  publishedMenuVersionId: "mv_1",
  publishedSourcePayloadKind: "square_catalog_v1",
  activePublishedItemCount: 3,
  activeSquareProviderEntityMappingCountForVendorAndLocation: 13,
  activeSquareItemMappingsForVendorAndLocation: 4,
  activeSquareModifierMappingsForVendorAndLocation: 9,
  activeSquareMappingsByLocation: [{ key: "LOC_1", totalCount: 13, itemCount: 4, modifierCount: 9 }],
  activeSquareMappingsByConnectionId: [
    { key: "conn_1", totalCount: 13, itemCount: 4, modifierCount: 9 },
  ],
  mappingsExistForAnotherLocation: false,
  first10UnmappedPublishedItems: [],
  first10MappingExternalIds: [],
};

describe("loadAdminSquareEnvDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSquareConfig.mockReturnValue({
      configured: true,
      environment: "sandbox",
    });
  });

  it("exposes env flags without secrets", async () => {
    const envDiag = loadAdminSquareEnvDiagnostics();

    expect(envDiag).toEqual({
      enableSquareIntegration: true,
      squareRoutingLive: true,
      squareEnvironment: "sandbox",
      squareOAuthConfigured: true,
    });
    expect(JSON.stringify(envDiag)).not.toMatch(/secret|password|token/i);
  });

  it("shows integration unavailable when ENABLE_SQUARE_INTEGRATION is false", async () => {
    const { env } = await import("@/lib/env");
    (env as { ENABLE_SQUARE_INTEGRATION?: string }).ENABLE_SQUARE_INTEGRATION = "false";

    const envDiag = loadAdminSquareEnvDiagnostics();
    expect(envDiag.enableSquareIntegration).toBe(false);

    (env as { ENABLE_SQUARE_INTEGRATION?: string }).ENABLE_SQUARE_INTEGRATION = "true";
  });

  it("shows global kill switch when SQUARE_ROUTING_LIVE is false", async () => {
    const { env } = await import("@/lib/env");
    (env as { SQUARE_ROUTING_LIVE?: string }).SQUARE_ROUTING_LIVE = "false";

    const envDiag = loadAdminSquareEnvDiagnostics();
    expect(envDiag.squareRoutingLive).toBe(false);

    (env as { SQUARE_ROUTING_LIVE?: string }).SQUARE_ROUTING_LIVE = "true";
  });
});

describe("loadAdminSquareOrderInjectionDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSquareConfig.mockReturnValue({
      configured: true,
      environment: "production",
    });
    mockVendorFind.mockResolvedValue({
      id: VENDOR_ID,
      name: "Poke Sea",
      orderRoutingMode: "square",
      squareOrderRoutingEnabled: false,
    });
    mockConnection.mockResolvedValue({ status: "connected" });
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockMapping.mockResolvedValue(mappingFixture);
    mockReadiness.mockResolvedValue({
      prerequisitesReady: true,
      injectionOperationalReady: false,
      locationId: "LOC_1",
      hasSquarePublishedMenu: true,
      activeItemMappingCount: 4,
      activeModifierMappingCount: 9,
      injectionBlockingReasons: [
        "Square order injection is disabled for this vendor.",
        "SQUARE_ROUTING_LIVE is not true — Square CreateOrder/CreatePayment API calls are blocked globally.",
      ],
      mappingCoverage: {
        ready: true,
        totalSellableItems: 4,
        mappedSellableItems: 4,
        missingItemIds: [],
        missingRequiredModifierOptionIds: [],
        mappingsExistForAnotherLocation: false,
        alternateLocationIds: [],
        blockers: [],
      },
    });
  });

  it("returns vendor diagnostics with mapping details and no secrets", async () => {
    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.vendor).toMatchObject({
      vendorId: VENDOR_ID,
      vendorName: "Poke Sea",
      orderRoutingMode: "square",
      squareOrderRoutingEnabled: false,
      squareConnectionStatus: "connected",
      selectedSquareLocation: "present",
      publishedSquareImportedMenu: "present",
      activeItemMappings: 4,
      activeModifierMappings: 9,
      routingReadiness: "not_ready",
      prerequisitesReady: true,
      injectionOperationalReady: false,
    });
    expect(diagnostics?.vendor.mappingCoverage.mappedSellableItems).toBe(4);
    expect(diagnostics?.vendor.mapping.activeSquareConnectionId).toBe("conn_1");
    expect(diagnostics?.vendor.mapping.externalLocationId).toBe("LOC_1");
    expect(diagnostics?.vendor.blockingReasons.some((r) => /injection is disabled/i.test(r))).toBe(
      true
    );
    expect(JSON.stringify(diagnostics)).not.toMatch(/SQUARE_APPLICATION_SECRET/);
    expect(JSON.stringify(diagnostics)).not.toMatch(/encryptedAccessToken/);
  });

  it("manual vendors still load env diagnostics without Square vendor blockers from routing mode", async () => {
    mockVendorFind.mockResolvedValue({
      id: VENDOR_ID,
      name: "Manual Vendor",
      orderRoutingMode: "manual_dashboard",
      squareOrderRoutingEnabled: false,
    });
    mockReadiness.mockResolvedValue({
      prerequisitesReady: false,
      injectionOperationalReady: false,
      locationId: null,
      hasSquarePublishedMenu: false,
      activeItemMappingCount: 0,
      activeModifierMappingCount: 0,
      injectionBlockingReasons: ["Order routing mode is not Square."],
      mappingCoverage: {
        ready: false,
        totalSellableItems: 0,
        mappedSellableItems: 0,
        missingItemIds: [],
        missingRequiredModifierOptionIds: [],
        mappingsExistForAnotherLocation: false,
        alternateLocationIds: [],
        blockers: [],
      },
    });
    mockMapping.mockResolvedValue({
      ...mappingFixture,
      vendorName: "Manual Vendor",
      orderRoutingMode: "manual_dashboard",
      activeSquareConnectionId: null,
      externalLocationId: null,
    });

    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.global.squareRoutingLive).toBe(true);
    expect(diagnostics?.vendor.orderRoutingMode).toBe("manual_dashboard");
    expect(diagnostics?.vendor.blockingReasons).toContain("Order routing mode is not Square.");
  });

  it("deliverect vendors are unaffected by SQUARE_ROUTING_LIVE in vendor diagnostics", async () => {
    mockVendorFind.mockResolvedValue({
      id: VENDOR_ID,
      name: "Deliverect Vendor",
      orderRoutingMode: "deliverect",
      squareOrderRoutingEnabled: false,
    });
    mockReadiness.mockResolvedValue({
      prerequisitesReady: false,
      injectionOperationalReady: false,
      locationId: null,
      hasSquarePublishedMenu: false,
      activeItemMappingCount: 0,
      activeModifierMappingCount: 0,
      injectionBlockingReasons: ["Order routing mode is not Square."],
      mappingCoverage: {
        ready: false,
        totalSellableItems: 0,
        mappedSellableItems: 0,
        missingItemIds: [],
        missingRequiredModifierOptionIds: [],
        mappingsExistForAnotherLocation: false,
        alternateLocationIds: [],
        blockers: [],
      },
    });

    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.vendor.orderRoutingMode).toBe("deliverect");
    expect(diagnostics?.global.squareRoutingLive).toBe(true);
    expect(diagnostics?.vendor.injectionOperationalReady).toBe(false);
  });
});
