import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssertCustomerOrderAccess = vi.fn();
const mockClearCheckoutSourceCartForOrder = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("@/lib/customer-order-access", () => ({
  assertCustomerOrderAccess: (...args: unknown[]) => mockAssertCustomerOrderAccess(...args),
}));

vi.mock("@/lib/rate-limit-http", () => ({
  applyRateLimits: vi.fn().mockReturnValue(null),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/session", () => ({
  getSessionIdFromRequest: vi.fn().mockReturnValue("sess_test"),
}));

vi.mock("@/services/cart.service", () => ({
  clearCheckoutSourceCartForOrder: (...args: unknown[]) =>
    mockClearCheckoutSourceCartForOrder(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
    delete: (...args: unknown[]) => mockCookieDelete(...args),
  }),
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const ORDER_ID = "ord_paid_1";

describe("POST /api/orders/[orderId]/post-checkout-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      customerPhone: "+15551234567",
    });
    mockCookieGet.mockReturnValue(undefined);
  });

  it("clears source cart and checkout cookie for paid orders", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      status: "paid",
      sourceCartId: "cart_src_1",
      podId: "pod_1",
    } as never);

    const res = await POST(new Request("http://localhost/api/orders/x/post-checkout-sync"), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cartId).toBe("cart_src_1");
    expect(mockClearCheckoutSourceCartForOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(mockCookieDelete).toHaveBeenCalledWith("mennyu_checkout");
  });

  it("does not clear cart for pending_payment orders", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      status: "pending_payment",
      sourceCartId: "cart_src_1",
      podId: "pod_1",
    } as never);

    const res = await POST(new Request("http://localhost/api/orders/x/post-checkout-sync"), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBeFalsy();
    expect(body.code).toBe("PENDING_PAYMENT");
    expect(mockClearCheckoutSourceCartForOrder).not.toHaveBeenCalled();
    expect(mockCookieDelete).not.toHaveBeenCalled();
  });

  it("rejects when customer access is denied", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Customer identity required.",
    });

    const res = await POST(new Request("http://localhost/api/orders/x/post-checkout-sync"), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(401);
    expect(mockClearCheckoutSourceCartForOrder).not.toHaveBeenCalled();
  });
});
