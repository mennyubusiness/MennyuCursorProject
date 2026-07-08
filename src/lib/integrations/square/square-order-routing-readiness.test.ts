import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFind = vi.fn();
const mockHealth = vi.fn();
const mockConnection = vi.fn();
const mockActiveMenu = vi.fn();
const mockMenuVersionFind = vi.fn();
const mockMappingCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: (...args: unknown[]) => mockVendorFind(...args) },
    menuVersion: { findFirst: (...args: unknown[]) => mockMenuVersionFind(...args) },
    providerEntityMapping: { count: (...args: unknown[]) => mockMappingCount(...args) },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { SQUARE_ROUTING_LIVE: "true" },
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  evaluateSquareConnectionHealth: (...args: unknown[]) => mockHealth(...args),
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockConnection(...args),
}));

vi.mock("@/lib/vendor-active-menu-version.server", () => ({
  loadActiveMenuVersionForVendor: (...args: unknown[]) => mockActiveMenu(...args),
}));

import {
  assertSquareOrderRoutingPrerequisites,
  assertSquareOrderRoutingReady,
  loadSquareOrderRoutingReadiness,
} from "@/lib/integrations/square/square-order-routing-readiness";

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
    mockMappingCount.mockResolvedValue(3);
  });

  it("prerequisites can be ready while injection is disabled", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(true);
    expect(status.injectionOperationalReady).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.enabled).toBe(false);
    expect(status.prerequisiteBlockers).toHaveLength(0);
    expect(status.injectionBlockingReasons.some((m) => /injection is disabled/i.test(m))).toBe(true);
  });

  it("is injection-ready when prerequisites, enablement, and global live switch pass", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status).toMatchObject({
      prerequisitesReady: true,
      injectionOperationalReady: true,
      ready: true,
      enabled: true,
      globalRoutingLive: true,
      connectionHealthy: true,
      hasSquarePublishedMenu: true,
      locationId: "LOC_1",
      activeItemMappingCount: 3,
    });
  });

  it("blocks injection when SQUARE_ROUTING_LIVE is false but prerequisites still pass", async () => {
    const { env } = await import("@/lib/env");
    (env as { SQUARE_ROUTING_LIVE?: string }).SQUARE_ROUTING_LIVE = "false";
    mockVendorFind.mockResolvedValue(baseVendor());

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(true);
    expect(status.injectionOperationalReady).toBe(false);
    expect(status.injectionBlockingReasons.some((m) => /SQUARE_ROUTING_LIVE/i.test(m))).toBe(true);

    (env as { SQUARE_ROUTING_LIVE?: string }).SQUARE_ROUTING_LIVE = "true";
  });

  it("is not prerequisite-ready when Square connection is unhealthy", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockHealth.mockResolvedValue({
      isReady: false,
      missingRequirements: ["Square OAuth token expired."],
    });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.connectionHealthy).toBe(false);
    expect(status.prerequisiteBlockers).toContain("Square OAuth token expired.");
  });

  it("is not prerequisite-ready when location is missing", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockConnection.mockResolvedValue({ externalLocationId: null });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.prerequisiteBlockers.some((m) => /location/i.test(m))).toBe(true);
  });

  it("is not prerequisite-ready without a published Square-imported menu", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "open_order_native" } },
    });

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.hasSquarePublishedMenu).toBe(false);
    expect(status.prerequisiteBlockers.some((m) => /imported from Square/i.test(m))).toBe(true);
  });

  it("is not prerequisite-ready without active item mappings", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockMappingCount.mockResolvedValue(0);

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.prerequisiteBlockers.some((m) => /item mappings/i.test(m))).toBe(true);
  });
});

describe("assertSquareOrderRoutingPrerequisites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue({ externalLocationId: "LOC_1" });
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
    mockMappingCount.mockResolvedValue(2);
  });

  it("allows enable when prerequisites pass even if injection is disabled", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const gate = await assertSquareOrderRoutingPrerequisites(VENDOR_ID);

    expect(gate).toEqual({ ok: true, locationId: "LOC_1" });
  });
});

describe("assertSquareOrderRoutingReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue({ externalLocationId: "LOC_1" });
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
    mockMappingCount.mockResolvedValue(2);
  });

  it("rejects submission when injection is disabled", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const gate = await assertSquareOrderRoutingReady(VENDOR_ID);

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.error).toMatch(/disabled/i);
    }
  });
});
