import { MenuImportJobStatus, MenuVersionState } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    providerEntityMapping: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    menuImportJob: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    menuImportRawPayload: { create: vi.fn() },
    menuImportIssue: { createMany: vi.fn() },
    menuVersion: { create: (...args: unknown[]) => mockCreate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    vendorIntegrationConnection: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  evaluateSquareConnectionHealth: vi.fn(),
  getActiveSquareConnectionForVendor: vi.fn(),
  ensureSquareAccessToken: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-api.client", () => ({
  fetchSquareCatalogForLocation: vi.fn(),
}));

vi.mock("@/lib/integrations/provider-mapping.service", () => ({
  upsertProviderEntityMapping: vi.fn().mockResolvedValue({ id: "map_1" }),
  hashProviderPayload: vi.fn(() => "hash"),
  deactivateProviderMappingsNotSeen: vi.fn().mockResolvedValue(0),
}));

import {
  importSquareCatalog,
  previewSquareCatalogImport,
  SquareCatalogImportError,
} from "@/lib/integrations/square/square-menu-import.service";
import {
  ensureSquareAccessToken,
  evaluateSquareConnectionHealth,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";
import { fetchSquareCatalogForLocation } from "@/lib/integrations/square/square-api.client";
import {
  deactivateProviderMappingsNotSeen,
  upsertProviderEntityMapping,
} from "@/lib/integrations/provider-mapping.service";

const LOCATION_ID = "LOC_1";

function healthyConnection() {
  return {
    id: "conn_1",
    vendorId: "vendor_1",
    externalLocationId: LOCATION_ID,
    accessTokenRef: "cred_1",
    squareEnvironment: "sandbox",
    capabilitiesMeta: { selectedLocationName: "Main" },
  };
}

function catalogObjects(): SquareCatalogObject[] {
  return [
    {
      type: "CATEGORY",
      id: "cat_1",
      present_at_all_locations: true,
      category_data: { name: "Food" },
    },
    {
      type: "ITEM",
      id: "item_1",
      present_at_all_locations: true,
      item_data: { name: "Sandwich", categories: [{ id: "cat_1" }] },
    },
    {
      type: "ITEM_VARIATION",
      id: "var_1",
      present_at_all_locations: true,
      item_variation_data: {
        item_id: "item_1",
        price_money: { amount: 899, currency: "USD" },
      },
    },
  ];
}

describe("square menu import service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluateSquareConnectionHealth).mockResolvedValue({
      provider: "square",
      status: "connected",
      isReady: true,
      missingRequirements: [],
      warnings: [],
      lastCheckedAt: new Date(),
    });
    vi.mocked(getActiveSquareConnectionForVendor).mockResolvedValue(healthyConnection() as never);
    vi.mocked(ensureSquareAccessToken).mockResolvedValue("vendor_token_xyz");
    vi.mocked(fetchSquareCatalogForLocation).mockResolvedValue(catalogObjects());
    mockFindFirst.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        menuImportJob: {
          create: vi.fn().mockResolvedValue({ id: "job_1" }),
          update: vi.fn(),
        },
        menuImportRawPayload: { create: vi.fn() },
        menuImportIssue: { createMany: vi.fn() },
        menuVersion: {
          create: vi.fn().mockResolvedValue({ id: "draft_ver_1" }),
        },
      })
    );
  });

  it("preview fetches catalog with connected vendor token and does not write menu data", async () => {
    const report = await previewSquareCatalogImport("vendor_1");

    expect(ensureSquareAccessToken).toHaveBeenCalled();
    expect(fetchSquareCatalogForLocation).toHaveBeenCalledWith("vendor_token_xyz", LOCATION_ID);
    expect(report.stats.items).toBe(1);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(upsertProviderEntityMapping).not.toHaveBeenCalled();
  });

  it("requires healthy Square connection", async () => {
    vi.mocked(evaluateSquareConnectionHealth).mockResolvedValue({
      provider: "square",
      status: "error",
      isReady: false,
      missingRequirements: ["Reconnect Square"],
      warnings: [],
      lastCheckedAt: new Date(),
    });

    await expect(previewSquareCatalogImport("vendor_1")).rejects.toThrow(SquareCatalogImportError);
  });

  it("imports draft menu and provider mappings without publishing", async () => {
    const report = await importSquareCatalog("vendor_1", "user_1");

    expect(report.jobId).toBe("job_1");
    expect(report.draftVersionId).toBe("draft_ver_1");
    expect(report.importedCount).toBeGreaterThan(0);
    expect(upsertProviderEntityMapping).toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalled();

    const txArg = mockTransaction.mock.calls[0]?.[0];
    const tx = {
      menuImportJob: {
        create: vi.fn().mockResolvedValue({ id: "job_1" }),
        update: vi.fn(),
      },
      menuImportRawPayload: { create: vi.fn() },
      menuImportIssue: { createMany: vi.fn() },
      menuVersion: { create: vi.fn().mockResolvedValue({ id: "draft_ver_1" }) },
    };
    await txArg(tx);
    expect(tx.menuVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: MenuVersionState.draft }),
      })
    );
    expect(tx.menuImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MenuImportJobStatus.awaiting_review }),
      })
    );
  });

  it("re-running import updates mappings and deactivates disappeared objects", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "existing_map" });
    vi.mocked(deactivateProviderMappingsNotSeen).mockResolvedValue(2);

    const report = await importSquareCatalog("vendor_1");

    expect(report.updatedCount).toBeGreaterThan(0);
    expect(deactivateProviderMappingsNotSeen).toHaveBeenCalled();
    expect(report.inactiveMappingsCount).toBe(2);
  });

  it("rejects empty catalog import", async () => {
    vi.mocked(fetchSquareCatalogForLocation).mockResolvedValue([
      {
        type: "CATEGORY",
        id: "cat_empty",
        present_at_all_locations: true,
        category_data: { name: "Empty" },
      },
    ]);

    await expect(importSquareCatalog("vendor_1")).rejects.toThrow(/no importable menu items/i);
  });
});
