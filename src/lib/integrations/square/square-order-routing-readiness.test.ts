import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFind = vi.fn();
const mockHealth = vi.fn();
const mockConnection = vi.fn();
const mockActiveMenu = vi.fn();
const mockMenuVersionFind = vi.fn();
const mockMappingCount = vi.fn();
const mockCoverage = vi.fn();

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

vi.mock("@/lib/integrations/square/square-mapping-coverage.server", () => ({
  evaluateSquareMenuMappingCoverage: (...args: unknown[]) => mockCoverage(...args),
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
    squareOrderRoutingEnabled: overrides?.squareOrderRoutingEnabled ?? false,
  };
}

function fullScopeConnection(overrides?: {
  externalLocationId?: string | null;
  capabilitiesMeta?: Record<string, unknown> | null;
}) {
  return {
    externalLocationId: "LOC_1",
    capabilitiesMeta: {
      authorizedScopes: [
        "MERCHANT_PROFILE_READ",
        "ITEMS_READ",
        "ORDERS_READ",
        "ORDERS_WRITE",
        "PAYMENTS_READ",
        "PAYMENTS_WRITE",
      ],
      permissionsVersion: 2,
    },
    ...overrides,
  };
}

function readyCoverage(overrides?: Record<string, unknown>) {
  return {
    ready: true,
    totalSellableItems: 3,
    mappedSellableItems: 3,
    missingItemIds: [],
    missingVariationIds: [],
    missingRequiredModifierGroupIds: [],
    missingRequiredModifierOptionIds: [],
    selectedLocationId: "LOC_1",
    mappingsExistForAnotherLocation: false,
    alternateLocationIds: [],
    blockers: [],
    ...overrides,
  };
}

describe("loadSquareOrderRoutingReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue(fullScopeConnection());
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
    mockMappingCount.mockResolvedValue(3);
    mockCoverage.mockResolvedValue(readyCoverage());
  });

  it("is operational when prerequisites pass even if squareOrderRoutingEnabled is false", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(true);
    expect(status.injectionOperationalReady).toBe(true);
    expect(status.ready).toBe(true);
    expect(status.injectionBlockingReasons.some((m) => /injection is disabled/i.test(m))).toBe(false);
  });

  it("is injection-ready when prerequisites and global live switch pass", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status).toMatchObject({
      prerequisitesReady: true,
      injectionOperationalReady: true,
      ready: true,
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
    mockCoverage.mockResolvedValue(readyCoverage({ selectedLocationId: null, ready: false }));

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

  it("is not prerequisite-ready without complete sellable item mapping coverage", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockCoverage.mockResolvedValue(
      readyCoverage({
        ready: false,
        totalSellableItems: 10,
        mappedSellableItems: 1,
        missingItemIds: ["mi_2"],
        blockers: [
          {
            code: "NEVER_MAPPED",
            entityType: "menu_item",
            internalId: "mi_2",
            selectedLocationId: "LOC_1",
            message: "missing",
          },
        ],
      })
    );

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.prerequisiteBlockers.some((m) => /1 of 10/i.test(m))).toBe(true);
  });

  it("is not prerequisite-ready when mappings exist only at another location", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockCoverage.mockResolvedValue(
      readyCoverage({
        ready: false,
        mappedSellableItems: 0,
        mappingsExistForAnotherLocation: true,
        alternateLocationIds: ["LOC_OLD"],
        blockers: [
          {
            code: "MAPPING_AT_DIFFERENT_LOCATION",
            entityType: "menu_item",
            internalId: "mi_1",
            selectedLocationId: "LOC_1",
            alternateLocationIds: ["LOC_OLD"],
            message: "other loc",
          },
        ],
      })
    );

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(status.prerequisiteBlockers.some((m) => /another Square location/i.test(m))).toBe(true);
  });

  it("is not prerequisite-ready when Square OAuth injection scopes are missing", async () => {
    mockVendorFind.mockResolvedValue(baseVendor());
    mockConnection.mockResolvedValue(
      fullScopeConnection({
        capabilitiesMeta: {
          authorizedScopes: ["MERCHANT_PROFILE_READ", "ITEMS_READ"],
          permissionsVersion: 1,
        },
      })
    );

    const status = await loadSquareOrderRoutingReadiness(VENDOR_ID);

    expect(status.prerequisitesReady).toBe(false);
    expect(
      status.prerequisiteBlockers.some((m) =>
        /Reconnect Square to grant order routing permissions/i.test(m)
      )
    ).toBe(true);
  });
});

describe("assertSquareOrderRoutingPrerequisites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue(fullScopeConnection());
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
    mockMappingCount.mockResolvedValue(2);
    mockCoverage.mockResolvedValue(readyCoverage({ totalSellableItems: 2, mappedSellableItems: 2 }));
  });

  it("allows routing when prerequisites pass regardless of squareOrderRoutingEnabled", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const gate = await assertSquareOrderRoutingPrerequisites(VENDOR_ID);

    expect(gate).toEqual({ ok: true, locationId: "LOC_1" });
  });
});

describe("assertSquareOrderRoutingReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealth.mockResolvedValue({ isReady: true, missingRequirements: [] });
    mockConnection.mockResolvedValue(fullScopeConnection());
    mockActiveMenu.mockResolvedValue({
      state: "published",
      menu: { deliverect: { sourcePayloadKind: "square_catalog_v1" } },
    });
    mockMenuVersionFind.mockResolvedValue(null);
    mockMappingCount.mockResolvedValue(2);
    mockCoverage.mockResolvedValue(readyCoverage({ totalSellableItems: 2, mappedSellableItems: 2 }));
  });

  it("allows submission when operational readiness passes even if squareOrderRoutingEnabled is false", async () => {
    mockVendorFind.mockResolvedValue(baseVendor({ squareOrderRoutingEnabled: false }));

    const gate = await assertSquareOrderRoutingReady(VENDOR_ID);

    expect(gate).toEqual({ ok: true, locationId: "LOC_1" });
  });
});
