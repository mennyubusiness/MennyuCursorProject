import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  canManageVendor: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-menu-import.service", () => ({
  previewSquareCatalogImport: vi.fn(),
  importSquareCatalog: vi.fn(),
  SquareCatalogImportError: class SquareCatalogImportError extends Error {},
}));

import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import {
  importSquareCatalogAction,
  previewSquareCatalogAction,
} from "@/actions/vendor-square-catalog.actions";
import {
  importSquareCatalog,
  previewSquareCatalogImport,
} from "@/lib/integrations/square/square-menu-import.service";

describe("vendor square catalog actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(canManageVendor).mockResolvedValue(true);
  });

  it("requires vendor owner/admin permission", async () => {
    vi.mocked(canManageVendor).mockResolvedValue(false);
    const result = await previewSquareCatalogAction("vendor_1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
    expect(previewSquareCatalogImport).not.toHaveBeenCalled();
  });

  it("preview action delegates to import service", async () => {
    vi.mocked(previewSquareCatalogImport).mockResolvedValue({
      menu: null,
      warnings: [],
      skipped: [],
      stats: { categories: 0, items: 0, modifierGroups: 0, modifierOptions: 0 },
      importStrategy: "test",
      locationId: "LOC_1",
      locationName: "Main",
      squareEnvironment: "sandbox",
    });

    const result = await previewSquareCatalogAction("vendor_1");
    expect(result.ok).toBe(true);
    expect(previewSquareCatalogImport).toHaveBeenCalledWith("vendor_1");
  });

  it("import action delegates to import service for authorized user", async () => {
    vi.mocked(importSquareCatalog).mockResolvedValue({
      menu: null,
      warnings: [],
      skipped: [],
      stats: { categories: 1, items: 1, modifierGroups: 0, modifierOptions: 0 },
      importStrategy: "test",
      locationId: "LOC_1",
      locationName: "Main",
      squareEnvironment: "sandbox",
      jobId: "job_1",
      draftVersionId: "draft_1",
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      warningCount: 0,
      inactiveMappingsCount: 0,
      errors: [],
    });

    const result = await importSquareCatalogAction("vendor_1");
    expect(result.ok).toBe(true);
    expect(importSquareCatalog).toHaveBeenCalledWith("vendor_1", "user_1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vendor/vendor_1/menu/imports");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vendor/vendor_1/menu-imports/job_1");
  });
});
