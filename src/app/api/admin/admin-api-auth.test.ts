import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsAdminApiAuthorized = vi.fn();
const mockApplyTransition = vi.fn();
const mockFindStalled = vi.fn();
const mockPodFindUnique = vi.fn();
const mockPodUpdate = vi.fn();
const mockDeliverectSyncDebug = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  isAdminApiRequestAuthorized: (...args: unknown[]) => mockIsAdminApiAuthorized(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  applyVendorOrderTransition: (...args: unknown[]) => mockApplyTransition(...args),
}));

vi.mock("@/services/pos-stalled-vendor-orders.service", () => ({
  findStalledPosManagedVendorOrders: (...args: unknown[]) => mockFindStalled(...args),
}));

vi.mock("@/services/deliverect-vendor-order-sync-debug.service", () => ({
  getVendorOrderDeliverectSyncDebug: (...args: unknown[]) => mockDeliverectSyncDebug(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
      update: (...args: unknown[]) => mockPodUpdate(...args),
    },
  },
}));

import { NextRequest } from "next/server";
import { PATCH as patchPodActive } from "./pods/[podId]/active/route";
import { GET as getStalledPos } from "./vendor-orders/stalled-pos/route";
import { POST as postVendorOrderTransition } from "./vendor-orders/[vendorOrderId]/transition/route";
import { GET as getDeliverectSync } from "./vendor-orders/[vendorOrderId]/deliverect-sync/route";

const layoutSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../admin/(dashboard)/layout.tsx"),
  "utf8"
);

describe("admin API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyTransition.mockResolvedValue({
      success: true,
      routingStatus: "confirmed",
      fulfillmentStatus: "accepted",
    });
    mockFindStalled.mockResolvedValue([]);
    mockPodFindUnique.mockResolvedValue({ id: "pod_1" });
    mockPodUpdate.mockResolvedValue({ id: "pod_1", isActive: false });
    mockDeliverectSyncDebug.mockResolvedValue({ vendorOrderId: "vo_1" });
  });

  describe("POST /api/admin/vendor-orders/[vendorOrderId]/transition", () => {
    it("rejects unauthenticated callers before transition", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(false);

      const res = await postVendorOrderTransition(
        new Request("http://localhost/api/admin/vendor-orders/vo/transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetState: "accepted" }),
        }),
        { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
      );

      expect(res.status).toBe(403);
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });

    it("allows authorized admin to transition", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(true);

      const res = await postVendorOrderTransition(
        new Request("http://localhost/api/admin/vendor-orders/vo/transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetState: "accepted" }),
        }),
        { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
      );

      expect(res.status).toBe(200);
      expect(mockApplyTransition).toHaveBeenCalledWith("vo_1", "accepted", "admin");
    });
  });

  describe("GET /api/admin/vendor-orders/stalled-pos", () => {
    it("rejects unauthenticated callers", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(false);

      const res = await getStalledPos(
        new NextRequest("http://localhost/api/admin/vendor-orders/stalled-pos")
      );

      expect(res.status).toBe(403);
      expect(mockFindStalled).not.toHaveBeenCalled();
    });

    it("allows authorized admin to list stalled POS orders", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(true);

      const res = await getStalledPos(
        new NextRequest("http://localhost/api/admin/vendor-orders/stalled-pos")
      );

      expect(res.status).toBe(200);
      expect(mockFindStalled).toHaveBeenCalled();
    });
  });

  describe("PATCH /api/admin/pods/[podId]/active", () => {
    it("rejects unauthenticated callers", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(false);

      const res = await patchPodActive(
        new Request("http://localhost/api/admin/pods/pod_1/active", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ podId: "pod_1" }) }
      );

      expect(res.status).toBe(403);
      expect(mockPodUpdate).not.toHaveBeenCalled();
    });

    it("allows authorized admin to toggle pod active state", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(true);

      const res = await patchPodActive(
        new Request("http://localhost/api/admin/pods/pod_1/active", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ podId: "pod_1" }) }
      );

      expect(res.status).toBe(200);
      expect(mockPodUpdate).toHaveBeenCalledWith({
        where: { id: "pod_1" },
        data: { isActive: false },
      });
    });
  });

  describe("GET /api/admin/vendor-orders/[vendorOrderId]/deliverect-sync", () => {
    it("rejects unauthenticated callers before debug lookup", async () => {
      mockIsAdminApiAuthorized.mockResolvedValue(false);

      const res = await getDeliverectSync(
        new Request("http://localhost/api/admin/vendor-orders/vo/deliverect-sync"),
        { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
      );

      expect(res.status).toBe(403);
      expect(mockDeliverectSyncDebug).not.toHaveBeenCalled();
    });
  });
});

describe("admin dashboard layout fail-closed", () => {
  it("redirects unauthorized users in production without requiring ADMIN_SECRET", () => {
    expect(layoutSrc).toContain('if (!allowed && env.NODE_ENV === "production")');
    expect(layoutSrc).toContain('redirect("/admin/access-denied")');
    expect(layoutSrc).not.toMatch(/ADMIN_SECRET/);
  });
});
