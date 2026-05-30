import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetOrderWithUnifiedStatus = vi.fn();
const mockAssertCustomerOrderAccess = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/user-order-access", () => ({
  userCanAccessOrder: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/customer-order-access", () => ({
  assertCustomerOrderAccess: (...args: unknown[]) => mockAssertCustomerOrderAccess(...args),
  persistCustomerOrderAccessCookies: vi.fn(),
}));

vi.mock("@/services/order-status.service", () => ({
  getOrderWithUnifiedStatus: (...args: unknown[]) => mockGetOrderWithUnifiedStatus(...args),
}));

vi.mock("@/services/payment.service", () => ({
  reconcilePaymentFromRedirect: vi.fn(),
}));

vi.mock("@/services/cart.service", () => ({
  clearCheckoutSourceCartForOrder: vi.fn(),
}));

vi.mock("@/services/order.service", () => ({
  attachLegacyOrdersToCustomerAccount: vi.fn(),
  getOrdersByCustomerAccountId: vi.fn(),
}));

vi.mock("@/services/reorder.service", () => ({
  reorderFromOrder: vi.fn(),
}));

vi.mock("@/lib/session-request", () => ({
  getMennyuSessionIdForRequest: vi.fn(),
}));

vi.mock("@/lib/customer-session", () => ({
  getCustomerSessionFromRequest: vi.fn(),
}));

vi.mock("@/services/customer-account-orders.service", () => ({
  getOrdersForSignedInUser: vi.fn(),
}));

import { getOrderStatusAction } from "@/actions/order.actions";

describe("getOrderStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when customer access is denied", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Customer identity required.",
    });

    const order = await getOrderStatusAction("ord_1");
    expect(order).toBeNull();
    expect(mockGetOrderWithUnifiedStatus).not.toHaveBeenCalled();
  });

  it("loads order status for authorized customer", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: true,
      orderId: "ord_1",
      customerPhone: "+15551234567",
    });
    mockGetOrderWithUnifiedStatus.mockResolvedValue({ id: "ord_1", status: "routing" });

    const order = await getOrderStatusAction("ord_1");
    expect(order?.id).toBe("ord_1");
    expect(mockGetOrderWithUnifiedStatus).toHaveBeenCalledWith("ord_1");
  });
});
