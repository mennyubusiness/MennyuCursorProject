import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const mockVendorFindUnique = vi.fn();
const mockVendorUpdate = vi.fn();
const mockPodFindUnique = vi.fn();
const mockPodUpdate = vi.fn();
const mockPodVendorFindMany = vi.fn();
const mockMenuItemUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
      update: (...args: unknown[]) => mockVendorUpdate(...args),
    },
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
      update: (...args: unknown[]) => mockPodUpdate(...args),
    },
    podVendor: {
      findMany: (...args: unknown[]) => mockPodVendorFindMany(...args),
    },
    menuItem: {
      updateMany: (...args: unknown[]) => mockMenuItemUpdateMany(...args),
    },
  },
}));

const mockCreateAdminAuditLog = vi.fn();

vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => mockCreateAdminAuditLog(...args),
}));

import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";
import { adminSetPodOrderingMode } from "@/services/admin-pod-rescue.service";
import { adminSetVendorOrderingMode } from "@/services/admin-vendor-rescue.service";

const REASON = "Vendor is menu-only for the winter season.";

beforeEach(() => {
  vi.clearAllMocks();
  mockVendorFindUnique.mockResolvedValue({
    id: "v_1",
    name: "Test Kitchen",
    orderingEnabled: true,
  });
  mockVendorUpdate.mockResolvedValue({ id: "v_1" });
  mockPodFindUnique.mockResolvedValue({
    id: "pod_1",
    name: "Test Pod",
    slug: "test-pod",
    orderingEnabled: true,
  });
  mockPodUpdate.mockResolvedValue({ id: "pod_1" });
  mockPodVendorFindMany.mockResolvedValue([]);
  mockCreateAdminAuditLog.mockResolvedValue(undefined);
});

describe("adminSetVendorOrderingMode", () => {
  it("writes only orderingEnabled when switching a vendor to menu-only", async () => {
    const result = await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(result.ok).toBe(true);
    expect(mockVendorUpdate).toHaveBeenCalledWith({
      where: { id: "v_1" },
      data: { orderingEnabled: false },
    });
  });

  /**
   * The whole point of durable intent is that re-enabling ordering restores the previous setup,
   * so a mode change must not touch menus, routing, or payment configuration.
   */
  it("does not mutate menu, routing, payment, or pause state", async () => {
    await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    const written = mockVendorUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(written.data)).toEqual(["orderingEnabled"]);
    for (const field of [
      "menuSource",
      "orderRoutingMode",
      "mennyuOrdersPaused",
      "isActive",
      "stripeConnectedAccountId",
      "stripeChargesEnabled",
      "stripePayoutsEnabled",
      "squareMerchantId",
      "deliverectChannelLinkId",
    ]) {
      expect(written.data).not.toHaveProperty(field);
    }
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("audits the mode change with old and new intent", async () => {
    await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(mockCreateAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDERING_MODE_MENU_ONLY,
        targetId: "v_1",
        oldValue: { orderingEnabled: true },
        newValue: { orderingEnabled: false },
      })
    );
  });

  it("audits re-enabling ordering without republishing the menu", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v_1",
      name: "Test Kitchen",
      orderingEnabled: false,
    });

    const result = await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: true,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(result.ok).toBe(true);
    expect(mockCreateAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDERING_MODE_ENABLED,
      })
    );
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    const result = await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: "",
    });

    expect(result.ok).toBe(false);
    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });

  it("rejects a no-op mode change", async () => {
    const result = await adminSetVendorOrderingMode({
      vendorId: "v_1",
      orderingEnabled: true,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(result.ok).toBe(false);
    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });
});

describe("adminSetPodOrderingMode", () => {
  it("writes only orderingEnabled on the pod", async () => {
    const result = await adminSetPodOrderingMode({
      podId: "pod_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(result.ok).toBe(true);
    expect(mockPodUpdate).toHaveBeenCalledWith({
      where: { id: "pod_1" },
      data: { orderingEnabled: false },
    });
  });

  /** Vendor intent must survive a pod-wide switch so it resumes when the pod is re-enabled. */
  it("leaves every vendor's own orderingEnabled untouched", async () => {
    await adminSetPodOrderingMode({
      podId: "pod_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(mockVendorUpdate).not.toHaveBeenCalled();
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("audits the pod mode change", async () => {
    await adminSetPodOrderingMode({
      podId: "pod_1",
      orderingEnabled: false,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(mockCreateAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.POD_ORDERING_MODE_MENU_ONLY,
        targetId: "pod_1",
        oldValue: { orderingEnabled: true },
        newValue: { orderingEnabled: false },
      })
    );
  });

  it("rejects a no-op mode change", async () => {
    const result = await adminSetPodOrderingMode({
      podId: "pod_1",
      orderingEnabled: true,
      adminUserId: "admin_1",
      reason: REASON,
    });

    expect(result.ok).toBe(false);
    expect(mockPodUpdate).not.toHaveBeenCalled();
  });
});
