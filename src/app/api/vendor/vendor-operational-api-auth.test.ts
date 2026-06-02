import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyVendorAccess = vi.fn();
const mockVendorFindUnique = vi.fn();
const mockVendorUpdate = vi.fn();
const mockVendorOrderFindUnique = vi.fn();
const mockVendorOrderFindMany = vi.fn();
const mockApplyTransition = vi.fn();

vi.mock("@/lib/vendor-dashboard-auth", () => ({
  verifyVendorAccessForApi: (...args: unknown[]) => mockVerifyVendorAccess(...args),
}));

vi.mock("@/lib/routing-availability", () => ({
  isRoutingRetryAvailable: () => false,
}));

vi.mock("@/lib/vendor-deliverect-dashboard-visibility", () => ({
  shouldOmitVendorOrderFromDeliverectDashboard: () => false,
  isDeliverectVendorOrderRoutingDegraded: () => false,
}));

vi.mock("@/services/order-status.service", () => ({
  applyVendorOrderTransition: (...args: unknown[]) => mockApplyTransition(...args),
}));

vi.mock("@/lib/refund-decision", () => ({
  getRefundDecision: vi.fn(),
}));

vi.mock("@/lib/refund-route-helpers", () => ({
  runAutomaticRefundForDecision: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
      update: (...args: unknown[]) => mockVendorUpdate(...args),
    },
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockVendorOrderFindUnique(...args),
      findMany: (...args: unknown[]) => mockVendorOrderFindMany(...args),
    },
    vendorOrderStatusHistory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { GET as getVendorOrders } from "./[vendorId]/orders/route";
import { PATCH as patchVendorPause } from "./[vendorId]/pause/route";
import { POST as postVendorOrderStatus } from "./orders/[vendorOrderId]/status/route";

const VENDOR_A = "vendor_a";
const VENDOR_B = "vendor_b";
const VO_ID = "vo_1";

function vendorRecord(vendorId: string) {
  return {
    id: vendorId,
    name: "Test Vendor",
    slug: "test-vendor",
    deliverectChannelLinkId: null,
    vendorDashboardToken: "token_a",
  };
}

describe("vendor operational API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorOrderFindMany.mockResolvedValue([]);
    mockVendorUpdate.mockResolvedValue({ mennyuOrdersPaused: true });
    mockApplyTransition.mockResolvedValue({ success: true, orderId: "ord_1" });
  });

  describe("GET /api/vendor/[vendorId]/orders", () => {
    it("rejects unauthenticated callers", async () => {
      mockVendorFindUnique.mockResolvedValue(vendorRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await getVendorOrders(new Request("http://localhost/api/vendor/a/orders"), {
        params: Promise.resolve({ vendorId: VENDOR_A }),
      });

      expect(res.status).toBe(403);
      expect(mockVendorOrderFindMany).not.toHaveBeenCalled();
    });

    it("rejects callers without access to the vendor", async () => {
      mockVendorFindUnique.mockResolvedValue(vendorRecord(VENDOR_B));
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await getVendorOrders(new Request("http://localhost/api/vendor/b/orders"), {
        params: Promise.resolve({ vendorId: VENDOR_B }),
      });

      expect(res.status).toBe(403);
      expect(mockVerifyVendorAccess).toHaveBeenCalledWith(
        VENDOR_B,
        expect.any(Request),
        "token_a"
      );
    });

    it("allows authorized vendor to list orders", async () => {
      mockVendorFindUnique.mockResolvedValue(vendorRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: true, mode: "session" });

      const res = await getVendorOrders(new Request("http://localhost/api/vendor/a/orders"), {
        params: Promise.resolve({ vendorId: VENDOR_A }),
      });

      expect(res.status).toBe(200);
      expect(mockVendorOrderFindMany).toHaveBeenCalled();
      const body = await res.json();
      expect(body.vendor.id).toBe(VENDOR_A);
    });
  });

  describe("POST /api/vendor/orders/[vendorOrderId]/status", () => {
    const requestBody = { vendorId: VENDOR_A, targetState: "accepted" };

    function voRecord(vendorId: string) {
      return {
        vendorId,
        routingStatus: "confirmed",
        fulfillmentStatus: "pending",
        manuallyRecoveredAt: null,
        statusHistory: [],
        vendor: { vendorDashboardToken: "token_a" },
      };
    }

    it("rejects unauthenticated callers", async () => {
      mockVendorOrderFindUnique.mockResolvedValue(voRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await postVendorOrderStatus(
        new Request("http://localhost/api/vendor/orders/vo/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
        { params: Promise.resolve({ vendorOrderId: VO_ID }) }
      );

      expect(res.status).toBe(403);
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });

    it("rejects caller authorized for a different vendor", async () => {
      mockVendorOrderFindUnique.mockResolvedValue(voRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await postVendorOrderStatus(
        new Request("http://localhost/api/vendor/orders/vo/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorId: VENDOR_B, targetState: "accepted" }),
        }),
        { params: Promise.resolve({ vendorOrderId: VO_ID }) }
      );

      expect(res.status).toBe(403);
      expect(mockVerifyVendorAccess).toHaveBeenCalledWith(
        VENDOR_A,
        expect.any(Request),
        "token_a"
      );
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });

    it("rejects body vendorId mismatch after auth", async () => {
      mockVendorOrderFindUnique.mockResolvedValue(voRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: true, mode: "session" });

      const res = await postVendorOrderStatus(
        new Request("http://localhost/api/vendor/orders/vo/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorId: VENDOR_B, targetState: "accepted" }),
        }),
        { params: Promise.resolve({ vendorOrderId: VO_ID }) }
      );

      expect(res.status).toBe(403);
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });

    it("allows authorized vendor to mutate status on manual (non-Deliverect) orders", async () => {
      mockVendorOrderFindUnique.mockResolvedValue(voRecord(VENDOR_A));
      mockVerifyVendorAccess.mockResolvedValue({ ok: true, mode: "session" });

      const res = await postVendorOrderStatus(
        new Request("http://localhost/api/vendor/orders/vo/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
        { params: Promise.resolve({ vendorOrderId: VO_ID }) }
      );

      expect(res.status).toBe(200);
      expect(mockApplyTransition).toHaveBeenCalledWith(VO_ID, "accepted", "vendor_dashboard");
    });

    it("rejects Deliverect-authoritative vendor status mutations", async () => {
      mockVendorOrderFindUnique.mockResolvedValue({
        ...voRecord(VENDOR_A),
        statusAuthority: "pos",
        lastStatusSource: "deliverect_webhook",
        deliverectChannelLinkId: "ch_deliverect",
        deliverectAttempts: 1,
        order: { updatedAt: new Date(Date.now() - 600_000) },
        vendor: {
          vendorDashboardToken: "token_a",
          deliverectChannelLinkId: "ch_deliverect",
        },
      });
      mockVerifyVendorAccess.mockResolvedValue({ ok: true, mode: "session" });

      const res = await postVendorOrderStatus(
        new Request("http://localhost/api/vendor/orders/vo/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
        { params: Promise.resolve({ vendorOrderId: VO_ID }) }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/Deliverect\/POS/i);
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/vendor/[vendorId]/pause", () => {
    it("rejects unauthenticated callers", async () => {
      mockVendorFindUnique.mockResolvedValue({
        id: VENDOR_A,
        vendorDashboardToken: "token_a",
      });
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await patchVendorPause(
        new Request("http://localhost/api/vendor/a/pause", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: true }),
        }),
        { params: Promise.resolve({ vendorId: VENDOR_A }) }
      );

      expect(res.status).toBe(403);
      expect(mockVendorUpdate).not.toHaveBeenCalled();
    });

    it("rejects callers without access to the vendor", async () => {
      mockVendorFindUnique.mockResolvedValue({
        id: VENDOR_B,
        vendorDashboardToken: "token_b",
      });
      mockVerifyVendorAccess.mockResolvedValue({ ok: false });

      const res = await patchVendorPause(
        new Request("http://localhost/api/vendor/b/pause", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: false }),
        }),
        { params: Promise.resolve({ vendorId: VENDOR_B }) }
      );

      expect(res.status).toBe(403);
      expect(mockVendorUpdate).not.toHaveBeenCalled();
    });

    it("allows authorized vendor to pause intake", async () => {
      mockVendorFindUnique.mockResolvedValue({
        id: VENDOR_A,
        vendorDashboardToken: "token_a",
      });
      mockVerifyVendorAccess.mockResolvedValue({ ok: true, mode: "session" });

      const res = await patchVendorPause(
        new Request("http://localhost/api/vendor/a/pause", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: true }),
        }),
        { params: Promise.resolve({ vendorId: VENDOR_A }) }
      );

      expect(res.status).toBe(200);
      expect(mockVendorUpdate).toHaveBeenCalledWith({
        where: { id: VENDOR_A },
        data: { mennyuOrdersPaused: true },
      });
    });
  });
});
