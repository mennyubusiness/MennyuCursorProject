import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorIntegrationConnection: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
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
  refreshSquareOAuthToken: vi.fn(),
  SquareApiError: class SquareApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SquareApiError";
    }
  },
}));

vi.mock("@/lib/integrations/integration-token-storage.service", () => ({
  storeIntegrationProviderTokens: vi.fn().mockResolvedValue({ credentialId: "cred_new" }),
  loadIntegrationProviderTokens: vi.fn(),
  updateIntegrationProviderTokens: vi.fn(),
  deleteIntegrationProviderCredential: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-config", () => ({
  getSquareConfigSnapshot: vi.fn(() => ({
    configured: true,
    partiallyConfigured: false,
    tokenStorageReady: true,
    environment: "sandbox",
    environmentMismatchWarnings: [],
    missingConfigLabels: [],
    invalidConfigLabels: [],
  })),
  resolveSquareEnvironment: vi.fn(() => "sandbox"),
}));

import { prisma } from "@/lib/db";
import {
  completeSquareOAuthForVendor,
  disconnectSquareForVendor,
  evaluateSquareConnectionHealth,
  selectSquareLocationForVendor,
} from "@/lib/integrations/square/square-connection.service";
import {
  exchangeSquareOAuthCode,
  fetchSquareLocations,
  refreshSquareOAuthToken,
} from "@/lib/integrations/square/square-api.client";
import {
  deleteIntegrationProviderCredential,
  loadIntegrationProviderTokens,
  storeIntegrationProviderTokens,
  updateIntegrationProviderTokens,
} from "@/lib/integrations/integration-token-storage.service";

describe("square connection service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeIntegrationProviderTokens).mockResolvedValue({ credentialId: "cred_new" });
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
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "conn_1" });

    const result = await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(result.needsLocationSelection).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
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
      { id: "loc_only", name: "Only", status: "ACTIVE", address: { address_line_1: "1 Main" } },
    ]);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "conn_1" });

    const result = await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(result.needsLocationSelection).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "connected",
          externalLocationId: "loc_only",
        }),
      })
    );
  });

  it("creates clear error when zero active locations", async () => {
    vi.mocked(exchangeSquareOAuthCode).mockResolvedValue({
      access_token: "at_1",
      merchant_id: "merchant_1",
    });
    vi.mocked(fetchSquareLocations).mockResolvedValue([
      { id: "loc_inactive", name: "Closed", status: "INACTIVE" },
    ]);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "conn_1" });

    const result = await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(result.needsLocationSelection).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "error",
          errorCode: "no_active_locations",
        }),
      })
    );
  });

  it("cleans old credential after successful reconnect", async () => {
    vi.mocked(exchangeSquareOAuthCode).mockResolvedValue({
      access_token: "at_1",
      merchant_id: "merchant_1",
    });
    vi.mocked(fetchSquareLocations).mockResolvedValue([
      { id: "loc_only", name: "Only", status: "ACTIVE" },
    ]);
    mockFindFirst
      .mockResolvedValueOnce({ accessTokenRef: "cred_old" })
      .mockResolvedValueOnce({ id: "conn_1", accessTokenRef: "cred_old", capabilities: null });
    mockUpdate.mockResolvedValue({ id: "conn_1" });

    await completeSquareOAuthForVendor({ vendorId: "v1", code: "code_1" });
    expect(deleteIntegrationProviderCredential).toHaveBeenCalledWith("cred_old");
  });

  it("does not delete old credential when token exchange fails", async () => {
    vi.mocked(exchangeSquareOAuthCode).mockRejectedValue(new Error("token_exchange_failed"));
    mockFindFirst.mockResolvedValue({ accessTokenRef: "cred_old" });

    await expect(completeSquareOAuthForVendor({ vendorId: "v1", code: "bad" })).rejects.toThrow(
      "token_exchange_failed"
    );
    expect(deleteIntegrationProviderCredential).not.toHaveBeenCalled();
  });

  it("rejects unknown location id on save", async () => {
    mockFindFirst.mockResolvedValue({
      id: "conn_1",
      status: "pending",
      displayName: "Square — Test Biz",
      externalMerchantId: "m1",
      externalLocationId: null,
      externalStoreId: null,
      accessTokenRef: "cred_1",
      createdAt: new Date(),
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
    });

    const result = await selectSquareLocationForVendor({
      vendorId: "v1",
      locationId: "loc_unknown",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects inactive location on save", async () => {
    mockFindFirst.mockResolvedValue({
      id: "conn_1",
      status: "pending",
      displayName: "Square",
      externalMerchantId: "m1",
      externalLocationId: null,
      externalStoreId: null,
      accessTokenRef: "cred_1",
      createdAt: new Date(),
      lastHealthCheckAt: null,
      errorCode: null,
      errorMessage: null,
      isActive: true,
      capabilities: {
        locations: [{ id: "loc_a", name: "A", status: "INACTIVE" }],
        pendingLocationSelection: true,
      },
    });

    const result = await selectSquareLocationForVendor({
      vendorId: "v1",
      locationId: "loc_a",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not active");
    }
  });

  it("disconnect deactivates connection and deletes credentials", async () => {
    mockFindFirst.mockResolvedValue({
      id: "conn_1",
      accessTokenRef: "cred_1",
      refreshTokenRef: "cred_1",
    });
    mockUpdate.mockResolvedValue({});

    await disconnectSquareForVendor("v1");
    expect(deleteIntegrationProviderCredential).toHaveBeenCalledWith("cred_1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          status: "disconnected",
          accessTokenRef: null,
        }),
      })
    );
  });

  it("token refresh failure degrades connection during health check", async () => {
    const connectionRow = {
      id: "conn_1",
      status: "connected",
      displayName: "Square",
      externalMerchantId: "m1",
      externalLocationId: "loc_a",
      externalStoreId: "loc_a",
      accessTokenRef: "cred_1",
      createdAt: new Date(),
      lastHealthCheckAt: null,
      errorCode: null,
      errorMessage: null,
      isActive: true,
      capabilities: {
        declaredCapabilities: [],
        squareEnvironment: "sandbox",
        locations: [{ id: "loc_a", name: "A", status: "ACTIVE" }],
        pendingLocationSelection: false,
        selectedLocationName: "A",
      },
    };
    mockFindFirst.mockResolvedValue(connectionRow);
    mockUpdate.mockResolvedValue({});
    vi.mocked(loadIntegrationProviderTokens).mockResolvedValue({
      credentialId: "cred_1",
      accessToken: "at",
      refreshToken: "rt",
      accessTokenExpiresAt: new Date(Date.now() + 30_000),
    });
    vi.mocked(refreshSquareOAuthToken).mockRejectedValue(new Error("refresh failed"));
    mockFindUnique.mockResolvedValue({ capabilities: connectionRow.capabilities });

    const health = await evaluateSquareConnectionHealth("v1");
    expect(health.isReady).toBe(false);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns missing location when no location selected", async () => {
    mockFindFirst.mockResolvedValue({
      id: "conn_1",
      status: "pending",
      displayName: "Square",
      externalMerchantId: "m1",
      externalLocationId: null,
      externalStoreId: null,
      accessTokenRef: "cred_1",
      createdAt: new Date(),
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
    });
    mockUpdate.mockResolvedValue({});

    const health = await evaluateSquareConnectionHealth("v1");
    expect(health.isReady).toBe(false);
    expect(health.missingRequirements.some((m) => m.includes("location"))).toBe(true);
  });
});
