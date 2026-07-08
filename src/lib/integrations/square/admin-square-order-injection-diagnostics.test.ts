import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFind = vi.fn();
const mockReadiness = vi.fn();
const mockConnection = vi.fn();
const mockHealth = vi.fn();
const mockSquareConfig = vi.fn();

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

import {
  loadAdminSquareEnvDiagnostics,
  loadAdminSquareOrderInjectionDiagnostics,
} from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";

const VENDOR_ID = "vendor_sq";

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
      orderRoutingMode: "square",
      squareOrderRoutingEnabled: false,
    });
    mockConnection.mockResolvedValue({ status: "connected" });
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
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
    });
  });

  it("returns vendor diagnostics with blocking reasons and no secrets", async () => {
    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.vendor).toMatchObject({
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
    expect(diagnostics?.vendor.blockingReasons.some((r) => /injection is disabled/i.test(r))).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toMatch(/SQUARE_APPLICATION_SECRET/);
  });

  it("manual vendors still load env diagnostics without Square vendor blockers from routing mode", async () => {
    mockVendorFind.mockResolvedValue({
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
    });

    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.global.squareRoutingLive).toBe(true);
    expect(diagnostics?.vendor.orderRoutingMode).toBe("manual_dashboard");
    expect(diagnostics?.vendor.blockingReasons).toContain("Order routing mode is not Square.");
  });

  it("deliverect vendors are unaffected by SQUARE_ROUTING_LIVE in vendor diagnostics", async () => {
    mockVendorFind.mockResolvedValue({
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
    });

    const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(VENDOR_ID);

    expect(diagnostics?.vendor.orderRoutingMode).toBe("deliverect");
    expect(diagnostics?.global.squareRoutingLive).toBe(true);
    expect(diagnostics?.vendor.injectionOperationalReady).toBe(false);
  });
});
