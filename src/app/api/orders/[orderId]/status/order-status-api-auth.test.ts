import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssertCustomerOrderAccess = vi.fn();
const mockGetCustomerOrderStatusPollSnapshot = vi.fn();

vi.mock("@/lib/customer-order-access", () => ({
  assertCustomerOrderAccess: (...args: unknown[]) => mockAssertCustomerOrderAccess(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  getCustomerOrderStatusPollSnapshot: (...args: unknown[]) =>
    mockGetCustomerOrderStatusPollSnapshot(...args),
}));

import { GET } from "./route";

const ORDER_ID = "ord_poll_test";

describe("GET /api/orders/[orderId]/status auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomerOrderStatusPollSnapshot.mockResolvedValue({
      id: ORDER_ID,
      status: "routing",
    });
  });

  it("returns 401 for unauthenticated callers", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Customer identity required.",
    });

    const res = await GET(new Request(`http://localhost/api/orders/${ORDER_ID}/status`), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(401);
    expect(mockGetCustomerOrderStatusPollSnapshot).not.toHaveBeenCalled();
  });

  it("returns 403 for wrong customer", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "This order does not belong to you.",
    });

    const res = await GET(new Request(`http://localhost/api/orders/${ORDER_ID}/status`), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(403);
    expect(mockGetCustomerOrderStatusPollSnapshot).not.toHaveBeenCalled();
  });

  it("returns poll snapshot for authorized customer", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      customerPhone: "+15551234567",
    });

    const res = await GET(new Request(`http://localhost/api/orders/${ORDER_ID}/status`), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockGetCustomerOrderStatusPollSnapshot).toHaveBeenCalledWith(ORDER_ID);
    const body = await res.json();
    expect(body.id).toBe(ORDER_ID);
  });
});
