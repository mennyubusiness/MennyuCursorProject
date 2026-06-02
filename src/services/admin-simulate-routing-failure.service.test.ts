import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApply = vi.fn();
const mockCreateIssue = vi.fn();
const mockGetIssues = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/services/vendor-order-status-instrumentation", () => ({
  applyVendorOrderStatusWithMeta: (...args: unknown[]) => mockApply(...args),
}));

vi.mock("@/services/issues.service", () => ({
  createVendorOrderIssue: (...args: unknown[]) => mockCreateIssue(...args),
  getVendorOrderIssues: (...args: unknown[]) => mockGetIssues(...args),
}));

import { simulateVendorOrderRoutingFailure } from "./admin-simulate-routing-failure.service";
import { SIMULATED_ROUTING_FAILURE_MESSAGE } from "@/lib/admin-simulate-routing-failure";

describe("simulateVendorOrderRoutingFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApply.mockResolvedValue("routing");
    mockGetIssues.mockResolvedValue([]);
    mockCreateIssue.mockResolvedValue({ id: "issue_1" });
  });

  it("sets routing failed fields and creates routing_failure issue", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      routingStatus: "sent",
      fulfillmentStatus: "pending",
      deliverectAttempts: 2,
      order: { status: "paid" },
    });

    const result = await simulateVendorOrderRoutingFailure("vo_1");

    expect(result.ok).toBe(true);
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorOrderId: "vo_1",
        patch: { routingStatus: "failed" },
        historySource: "admin_simulate_routing_failure",
        extraVendorOrderUpdate: expect.objectContaining({
          deliverectLastError: SIMULATED_ROUTING_FAILURE_MESSAGE,
          deliverectAttempts: 3,
        }),
      }),
      "admin_simulate_routing_failure"
    );
    expect(mockCreateIssue).toHaveBeenCalledWith("vo_1", "routing_failure", "HIGH", {
      notes: SIMULATED_ROUTING_FAILURE_MESSAGE,
      createdBy: "admin",
    });
  });

  it("does not duplicate routing_failure issue when one is open", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      routingStatus: "pending",
      fulfillmentStatus: "pending",
      deliverectAttempts: 0,
      order: { status: "routing" },
    });
    mockGetIssues.mockResolvedValue([{ id: "i1", type: "routing_failure" }]);

    const result = await simulateVendorOrderRoutingFailure("vo_1");

    expect(result.ok).toBe(true);
    expect(mockCreateIssue).not.toHaveBeenCalled();
  });

  it("blocks unpaid orders", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      routingStatus: "pending",
      fulfillmentStatus: "pending",
      deliverectAttempts: 0,
      order: { status: "pending_payment" },
    });

    const result = await simulateVendorOrderRoutingFailure("vo_1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ORDER_UNPAID");
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("blocks terminal vendor fulfillment", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      routingStatus: "confirmed",
      fulfillmentStatus: "completed",
      deliverectAttempts: 1,
      order: { status: "paid" },
    });

    const result = await simulateVendorOrderRoutingFailure("vo_1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TERMINAL_FULFILLMENT");
  });
});
