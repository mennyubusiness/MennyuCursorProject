import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreateAudit = vi.fn();

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
  },
}));

vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => mockCreateAudit(...args),
}));

vi.mock("@/lib/integrations/square/square-routing-readiness", () => ({
  assertSquareRoutingSelectable: vi.fn(),
}));

import { adminUpdateVendorOrderRoutingMode } from "@/services/admin-vendor-rescue.service";
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
    vi.mocked(assertSquareRoutingSelectable).mockResolvedValue({ ok: true });
  });

  it("allows manual dashboard routing", async () => {
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "manual_dashboard",
      adminUserId: "admin_1",
      reason: "test manual",
    });
    expect(result.ok).toBe(true);
    expect(assertSquareRoutingSelectable).not.toHaveBeenCalled();
  });

  it("allows deliverect routing without square validation", async () => {
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderRoutingMode: "deliverect",
          menuSource: "deliverect",
        }),
      })
    );
  });

  it("allows square routing when Square connection is healthy", async () => {
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "square",
      adminUserId: "admin_1",
      reason: "test square",
    });
    expect(result.ok).toBe(true);
    expect(assertSquareRoutingSelectable).toHaveBeenCalledWith("vendor_1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderRoutingMode: "square",
          menuSource: "open_order",
        }),
      })
    );
  });

  it("rejects square routing when Square is not ready", async () => {
    vi.mocked(assertSquareRoutingSelectable).mockResolvedValue({
      ok: false,
      error:
        "Square must be connected with a selected active location before this vendor can use Square routing.",
    });
    const result = await adminUpdateVendorOrderRoutingMode({
      vendorId: "vendor_1",
      orderRoutingMode: "square",
      adminUserId: "admin_1",
      reason: "test square blocked",
    });
    expect(result.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
