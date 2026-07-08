import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorized = vi.fn();
const mockDiagnostics = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  isAdminDashboardLayoutAuthorized: (...args: unknown[]) => mockAuthorized(...args),
}));

vi.mock("@/lib/integrations/square/admin-square-order-injection-diagnostics.server", () => ({
  loadAdminSquareOrderInjectionDiagnostics: (...args: unknown[]) => mockDiagnostics(...args),
}));

import { GET } from "./route";

describe("GET /admin/vendors/[vendorId]/square-routing-debug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorized.mockResolvedValue(true);
    mockDiagnostics.mockResolvedValue({
      global: {
        enableSquareIntegration: true,
        squareRoutingLive: true,
        squareEnvironment: "sandbox",
        squareOAuthConfigured: true,
      },
      vendor: {
        orderRoutingMode: "square",
        squareOrderRoutingEnabled: false,
        squareConnectionStatus: "connected",
        selectedSquareLocation: "present",
        publishedSquareImportedMenu: "present",
        activeItemMappings: 2,
        activeModifierMappings: 1,
        routingReadiness: "not_ready",
        blockingReasons: ["Square order injection is disabled for this vendor."],
        prerequisitesReady: true,
        injectionOperationalReady: false,
      },
    });
  });

  it("returns safe JSON for authorized admins", async () => {
    const res = await GET(new Request("http://localhost/admin/vendors/vendor_sq/square-routing-debug"), {
      params: Promise.resolve({ vendorId: "vendor_sq" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.global.squareRoutingLive).toBe(true);
    expect(body.vendor.squareOrderRoutingEnabled).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/secret|password|token/i);
  });

  it("rejects unauthenticated callers", async () => {
    mockAuthorized.mockResolvedValue(false);

    const res = await GET(new Request("http://localhost/admin/vendors/vendor_sq/square-routing-debug"), {
      params: Promise.resolve({ vendorId: "vendor_sq" }),
    });

    expect(res.status).toBe(403);
  });
});
