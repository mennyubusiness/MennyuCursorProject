import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFind = vi.fn();
const mockHealth = vi.fn();
const mockConnection = vi.fn();
const mockActiveMenu = vi.fn();
const mockMenuVersionFind = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: (...args: unknown[]) => mockVendorFind(...args) },
    menuVersion: { findFirst: (...args: unknown[]) => mockMenuVersionFind(...args) },
  },
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  evaluateSquareConnectionHealth: (...args: unknown[]) => mockHealth(...args),
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockConnection(...args),
}));

vi.mock("@/lib/vendor-active-menu-version.server", () => ({
  loadActiveMenuVersionForVendor: (...args: unknown[]) => mockActiveMenu(...args),
}));

import { loadSquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";

const VENDOR_ID = "vendor_sq";

function baseVendor(overrides?: Partial<{ orderRoutingMode: string; squareOrderRoutingEnabled: boolean }>) {
  return {
    orderRoutingMode: overrides?.orderRoutingMode ?? "square",
    squareOrderRoutingEnabled: overrides?.squareOrderRoutingEnabled ?? true,
  };
}

describe("loadSquareOrderRoutingReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue({ externalLocationId: "LOC_1" });
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
  });

  it("is not ready when Square order routing is not explicitly enabled", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.ready).toBe(false);
    expect(status.enabled).toBe(false);
    expect(status.missingRequirements.some((m) => /not enabled/i.test(m))).toBe(true);
  });

  it("is not ready when Square connection is unhealthy", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockHealth.mockResolvedValue({
      isReady: false,
      missingRequirements: ["Square OAuth token expired."],
    });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.ready).toBe(false);
    expect(status.connectionHealthy).toBe(false);
    expect(status.missingRequirements).toContain("Square OAuth token expired.");
  });

  it("is not ready when location is missing", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockConnection.mockResolvedValue({ externalLocationId: null });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.ready).toBe(false);
    expect(status.missingRequirements.some((m) => /location/i.test(m))).toBe(true);
  });

  it("is not ready without a published Square-imported menu", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "open_order_native" } },
    });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.ready).toBe(false);
    expect(status.hasSquarePublishedMenu).toBe(false);
    expect(status.missingRequirements.some((m) => /imported from Square/i.test(m))).toBe(true);
  });

  it("is ready when all prerequisites pass", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status).toMatchObject({
      ready: true,
      enabled: true,
      connectionHealthy: true,
      hasSquarePublishedMenu: true,
      locationId: "LOC_1",
    });
  });
});
