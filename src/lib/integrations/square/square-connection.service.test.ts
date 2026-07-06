import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorIntegrationConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    integrationProviderCredential: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/integrations/square/square-api.client", () => ({
  exchangeSquareOAuthCode: vi.fn(),
  fetchSquareLocations: vi.fn(),
  fetchSquareMerchantProfile: vi.fn().mockResolvedValue({ business_name: "Test Biz" }),
}));

vi.mock("@/lib/integrations/integration-token-storage.service", () => ({
  storeIntegrationProviderTokens: vi.fn().mockResolvedValue({ credentialId: "cred_1" }),
  loadIntegrationProviderTokens: vi.fn(),
  updateIntegrationProviderTokens: vi.fn(),
  deleteIntegrationProviderCredential: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-config", () => ({
  getSquareConfigSnapshot: vi.fn(() => ({
    configured: true,
    partiallyConfigured: false,
    tokenStorageReady: true,
  })),
  resolveSquareEnvironment: vi.fn(() => "sandbox"),
}));

import { prisma } from "@/lib/db";
import {
  completeSquareOAuthForVendor,
  evaluateSquareConnectionHealth,
  selectSquareLocationForVendor,
} from "@/lib/integrations/square/square-connection.service";
import {
  exchangeSquareOAuthCode,
  fetchSquareLocations,
} from "@/lib/integrations/square/square-api.client";

describe("square connection service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates connection and requires location selection for multiple active locations", async () => {
    vi.mocked(exchangeSquareOAuthCode).mockResolvedValue({
      access_token: "at_1",
      refresh_token: "rt_1",
      merchant_id: "merchant_1",
    });
    vi.mocked(fetchSquareLocations).mockResolvedValue([
      { id: "loc_a", name: "A", status: "ACTIVE" },
      { id: "loc_b", name: "B", status: "ACTIVE" },
    ]);
    vi.mocked(prisma.vendorIntegrationConnection.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.vendorIntegrationConnection.create).mockResolvedValue({
      id: "conn_1",
    } as never);

    const result = await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(result.needsLocationSelection).toBe(true);
    expect(prisma.vendorIntegrationConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
          provider: "square",
        }),
      })
    );
  });

  it("auto-selects single active location", async () => {
    vi.mocked(exchangeSquareOAuthCode).mockResolvedValue({
      access_token: "at_1",
      merchant_id: "merchant_1",
    });
    vi.mocked(fetchSquareLocations).mockResolvedValue([
      { id: "loc_only", name: "Only", status: "ACTIVE" },
    ]);
    vi.mocked(prisma.vendorIntegrationConnection.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.vendorIntegrationConnection.create).mockResolvedValue({
      id: "conn_1",
    } as never);

    const result = await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(result.needsLocationSelection).toBe(false);
    expect(prisma.vendorIntegrationConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "connected",
          externalLocationId: "loc_only",
        }),
      })
    );
  });

  it("returns missing_location when no location selected", async () => {
    vi.mocked(prisma.vendorIntegrationConnection.findFirst)
      .mockResolvedValueOnce({
        id: "conn_1",
        status: "pending",
        displayName: "Square",
        externalMerchantId: "m1",
        externalLocationId: null,
        externalStoreId: null,
        accessTokenRef: "cred_1",
        lastHealthCheckAt: null,
        errorCode: null,
        errorMessage: null,
        isActive: true,
        capabilities: {
          declaredCapabilities: [],
          squareEnvironment: "sandbox",
          locations: [{ id: "loc_a", name: "A", status: "ACTIVE" }],
          pendingLocationSelection: true,
        },
      } as never)
      .mockResolvedValueOnce({
        id: "conn_1",
        status: "pending",
        displayName: "Square",
        externalMerchantId: "m1",
        externalLocationId: null,
        externalStoreId: null,
        accessTokenRef: "cred_1",
        lastHealthCheckAt: null,
        errorCode: null,
        errorMessage: null,
        isActive: true,
        capabilities: {
          declaredCapabilities: [],
          squareEnvironment: "sandbox",
          locations: [{ id: "loc_a", name: "A", status: "ACTIVE" }],
          pendingLocationSelection: true,
        },
      } as never);
    vi.mocked(prisma.vendorIntegrationConnection.update).mockResolvedValue({} as never);

    const health = await evaluateSquareConnectionHealth("v1");
    expect(health.isReady).toBe(false);
    expect(health.missingRequirements.some((m) => m.includes("location"))).toBe(true);
  });

  it("selectSquareLocationForVendor saves location", async () => {
    vi.mocked(prisma.vendorIntegrationConnection.findFirst).mockResolvedValue({
      id: "conn_1",
      status: "pending",
      displayName: "Square",
      externalMerchantId: "m1",
      externalLocationId: null,
      externalStoreId: null,
      accessTokenRef: "cred_1",
      lastHealthCheckAt: null,
      errorCode: null,
      errorMessage: null,
      isActive: true,
      capabilities: {
        locations: [{ id: "loc_a", name: "A", status: "ACTIVE" }],
        pendingLocationSelection: true,
      },
    } as never);
    vi.mocked(prisma.vendorIntegrationConnection.update).mockResolvedValue({} as never);

    const result = await selectSquareLocationForVendor({ vendorId: "v1", locationId: "loc_a" });
    expect(result.ok).toBe(true);
  });
});
