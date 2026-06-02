import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGate = vi.fn();
const mockSimulate = vi.fn();

vi.mock("@/lib/admin-test-tools", () => ({
  assertAdminTestToolsApiAccess: (...args: unknown[]) => mockGate(...args),
}));

vi.mock("@/services/admin-simulate-routing-failure.service", () => ({
  simulateVendorOrderRoutingFailure: (...args: unknown[]) => mockSimulate(...args),
}));

import { POST } from "./route";

describe("POST simulate-routing-failure", () => {
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

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ vendorOrderId: "vo_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("DISABLED");
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-platform-admin", async () => {
    mockGate.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Platform admin required.",
      code: "FORBIDDEN",
    });

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ vendorOrderId: "vo_1" }),
    });

    expect(res.status).toBe(403);
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it("returns ok true when simulation succeeds", async () => {
    mockSimulate.mockResolvedValue({
      ok: true,
      vendorOrderId: "vo_1",
      orderId: "ord_1",
      routingStatus: "failed",
      fulfillmentStatus: "pending",
      parentStatus: "routing",
    });

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ vendorOrderId: "vo_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSimulate).toHaveBeenCalledWith("vo_1");
  });

  it("returns 409 for unpaid order simulation", async () => {
    mockSimulate.mockResolvedValue({
      ok: false,
      code: "ORDER_UNPAID",
      error: "Order must be paid",
    });

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ vendorOrderId: "vo_1" }),
    });

    expect(res.status).toBe(409);
  });
});
