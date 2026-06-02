import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGate = vi.fn();
const mockSimulate = vi.fn();

vi.mock("@/lib/admin-test-tools", () => ({
  assertAdminTestToolsApiAccess: (...args: unknown[]) => mockGate(...args),
}));

vi.mock("@/services/admin-simulate-deliverect-status.service", () => ({
  simulateVendorOrderDeliverectStatus: (...args: unknown[]) => mockSimulate(...args),
}));

import { POST } from "./route";

describe("POST simulate-deliverect-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGate.mockResolvedValue({ ok: true });
  });

  it("returns 404 when admin test tools are disabled", async () => {
    mockGate.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not found",
      code: "DISABLED",
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ statusCode: 70 }),
      }),
      { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
    );

    expect(res.status).toBe(404);
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-platform-admin", async () => {
    mockGate.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Platform admin required.",
      code: "FORBIDDEN",
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ statusCode: 70 }),
      }),
      { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
    );

    expect(res.status).toBe(403);
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it("returns ok true with mapped fulfillment when simulation succeeds", async () => {
    mockSimulate.mockResolvedValue({
      ok: true,
      vendorOrderId: "vo_1",
      orderId: "ord_1",
      statusCode: 70,
      mappedFulfillmentStatus: "ready",
      mappedRoutingStatus: "confirmed",
      outcome: "applied",
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ statusCode: 70, note: "QA" }),
      }),
      { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mappedFulfillmentStatus).toBe("ready");
    expect(mockSimulate).toHaveBeenCalledWith("vo_1", 70, "QA");
  });

  it("returns 409 for unpaid order simulation", async () => {
    mockSimulate.mockResolvedValue({
      ok: false,
      code: "ORDER_UNPAID",
      error: "Order must be paid",
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ statusCode: 50 }),
      }),
      { params: Promise.resolve({ vendorOrderId: "vo_1" }) }
    );

    expect(res.status).toBe(409);
  });
});
