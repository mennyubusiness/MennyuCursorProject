import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApplyAdmin = vi.fn();

vi.mock("@/services/order-status.service", () => ({
  applyDeliverectStatusFromAdminSimulator: (...args: unknown[]) => mockApplyAdmin(...args),
}));

import {
  applyDeliverectOrderStatusUpdate,
  buildAdminSimulatedDeliverectWebhookPayload,
} from "./deliverect-order-status.service";

describe("deliverect-order-status.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyAdmin.mockResolvedValue({
      outcome: "applied",
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      updatedVendorOrderState: true,
    });
  });

  it("buildAdminSimulatedDeliverectWebhookPayload includes admin simulator metadata", () => {
    const p = buildAdminSimulatedDeliverectWebhookPayload(70, { note: "QA ready" });
    expect(p.status).toBe("70");
    expect(p._openOrderAdminSimulator).toMatchObject({
      source: "admin_simulator",
      statusCode: 70,
      note: "QA ready",
    });
  });

  it("applyDeliverectOrderStatusUpdate uses applyDeliverectStatusFromAdminSimulator", async () => {
    const result = await applyDeliverectOrderStatusUpdate({
      vendorOrderId: "vo_1",
      statusCode: 60,
      source: "admin_simulator",
      note: "prepared",
    });

    expect(mockApplyAdmin).toHaveBeenCalledTimes(1);
    const [, , payload] = mockApplyAdmin.mock.calls[0] as [string, null, Record<string, unknown>];
    expect(payload.status).toBe("60");
    expect(payload._openOrderAdminSimulator?.note).toBe("prepared");
    expect(result.mappedFulfillmentStatus).toBe("preparing");
    expect(result.outcome).toBe("applied");
  });

  it("unknown 999 returns unmapped outcome without throwing", async () => {
    mockApplyAdmin.mockResolvedValue({
      outcome: "unmapped_status",
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      updatedVendorOrderState: false,
    });

    const result = await applyDeliverectOrderStatusUpdate({
      vendorOrderId: "vo_1",
      statusCode: 999,
      source: "admin_simulator",
    });

    expect(result.mappedFulfillmentStatus).toBeNull();
    expect(result.outcome).toBe("unmapped_status");
  });
});
