import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreateAudit = vi.fn();
const mockReconcile = vi.fn();
const mockTransaction = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/services/vendor-customer-menu-cache.service", () => ({
  revalidateCustomerVendorMenuCacheForVendor: vi.fn(),
}));

vi.mock("@/services/menu-active-scope.service", () => ({
  revalidateOperationalMenuCacheForVendor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    podVendor: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => mockCreateAudit(...args),
}));

vi.mock("@/services/vendor-menu-source-ownership.service", () => ({
  reconcileVendorMenuSourceOwnership: (...args: unknown[]) => mockReconcile(...args),
  repairInconsistentVendorMenuSourceOwnership: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-routing-readiness", () => ({
  assertSquareRoutingSelectable: vi.fn(),
}));

const mockAssertPrerequisites = vi.fn();

vi.mock("@/lib/integrations/square/square-order-routing-readiness", () => ({
  assertSquareOrderRoutingPrerequisites: (...args: unknown[]) => mockAssertPrerequisites(...args),
}));

import { revalidatePath } from "next/cache";
import {
  adminSetSquareOrderRoutingEnabled,
  adminUpdateVendorOrderRoutingMode,
} from "@/services/admin-vendor-rescue.service";
import { assertSquareRoutingSelectable } from "@/lib/integrations/square/square-routing-readiness";

describe("adminUpdateVendorOrderRoutingMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockImplementation(async (args: { select?: { slug?: boolean } }) => {
      if (args?.select?.slug) {
        return { slug: "test-vendor" };
      }
      return {
        id: "vendor_1",
        orderRoutingMode: "manual_dashboard",
        menuSource: "open_order",
      };
    });
    mockUpdate.mockResolvedValue({});
    mockCreateAudit.mockResolvedValue({});
    mockReconcile.mockResolvedValue({
      vendorId: "vendor_1",
      orderRoutingMode: "deliverect",
      previousMenuSource: "open_order",
      menuSource: "deliverect",
      provider: "deliverect",
      archivedMenuVersionIds: ["mv_oo"],
      softDisabledMenuItemCount: 2,
      menuSourceUpdated: true,
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    vi.mocked(assertSquareRoutingSelectable).mockResolvedValue({ ok: true });
  });

  it("allows manual dashboard routing", async () => {
    mockReconcile.mockResolvedValue({
      vendorId: "vendor_1",
      orderRoutingMode: "manual_dashboard",
      previousMenuSource: "open_order",
      menuSource: "open_order",
      provider: "open_order",
      archivedMenuVersionIds: [],
      softDisabledMenuItemCount: 0,
      menuSourceUpdated: false,
    });
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "manual_dashboard",
      adminUserId: "admin_1",
      reason: "test manual",
    });
    expect(result.ok).toBe(true);
    expect(assertSquareRoutingSelectable).not.toHaveBeenCalled();
  });

  it("reconciles menu ownership when switching to deliverect", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vendor_1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "deliverect",
      adminUserId: "admin_1",
      reason: "test deliverect",
    });
    expect(result.ok).toBe(true);
    expect(mockReconcile).toHaveBeenCalledWith(
      {
        vendorId: "vendor_1",
        orderRoutingMode: "deliverect",
      },
      expect.anything()
    );
    expect(mockCreateAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: "deliverect / menu:deliverect",
        metadata: expect.objectContaining({
          archivedMenuVersionIds: ["mv_oo"],
          softDisabledMenuItemCount: 2,
          provider: "deliverect",
        }),
      })
    );
  });

  it("allows square routing and reconciles to open_order menu source / square provider", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vendor_1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockReconcile.mockResolvedValue({
      vendorId: "vendor_1",
      orderRoutingMode: "square",
      previousMenuSource: "open_order",
      menuSource: "open_order",
      provider: "square",
      archivedMenuVersionIds: [],
      softDisabledMenuItemCount: 0,
      menuSourceUpdated: false,
    });
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "square",
      adminUserId: "admin_1",
      reason: "test square before connect",
    });
    expect(result.ok).toBe(true);
    expect(mockReconcile).toHaveBeenCalledWith(
      {
        vendorId: "vendor_1",
        orderRoutingMode: "square",
      },
      expect.anything()
    );
  });
});

describe("adminSetSquareOrderRoutingEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "vendor_1",
      orderRoutingMode: "square",
      squareOrderRoutingEnabled: false,
    });
    mockUpdate.mockResolvedValue({});
    mockCreateAudit.mockResolvedValue({});
    mockAssertPrerequisites.mockResolvedValue({ ok: true, locationId: "LOC_1" });
  });

  it("enables squareOrderRoutingEnabled when prerequisites pass", async () => {
    const result = await adminSetSquareOrderRoutingEnabled({
      vendorId: "vendor_1",
      enabled: true,
      adminUserId: "admin_1",
      reason: "enable injection",
    });

    expect(result.ok).toBe(true);
    expect(mockAssertPrerequisites).toHaveBeenCalledWith("vendor_1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { squareOrderRoutingEnabled: true },
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/vendors/vendor_1");
  });

  it("rejects enable when prerequisites fail", async () => {
    mockAssertPrerequisites.mockResolvedValue({
      ok: false,
      error: "Square location is not selected.",
      code: "SQUARE_ROUTING_NOT_READY",
    });

    const result = await adminSetSquareOrderRoutingEnabled({
      vendorId: "vendor_1",
      enabled: true,
      adminUserId: "admin_1",
      reason: "enable injection",
    });

    expect(result.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
