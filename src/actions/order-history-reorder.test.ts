import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockGetOrdersForSignedInUser = vi.fn();
const mockAssertCustomerOrderAccess = vi.fn();
const mockUserCanAccessOrder = vi.fn();
const mockGetMennyuSessionIdForRequest = vi.fn();
const mockReorderFromOrder = vi.fn();
const mockPrismaFindUnique = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/customer-order-access", () => ({
  assertCustomerOrderAccess: (...args: unknown[]) => mockAssertCustomerOrderAccess(...args),
}));

vi.mock("@/lib/user-order-access", () => ({
  userCanAccessOrder: (...args: unknown[]) => mockUserCanAccessOrder(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
  },
}));

vi.mock("@/services/customer-account-orders.service", () => ({
  getOrdersForSignedInUser: (...args: unknown[]) => mockGetOrdersForSignedInUser(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  getOrderWithUnifiedStatus: vi.fn(),
}));

vi.mock("@/services/payment.service", () => ({
  reconcilePaymentFromRedirect: vi.fn(),
}));

vi.mock("@/services/cart.service", () => ({
  clearCheckoutSourceCartForOrder: vi.fn(),
}));

vi.mock("@/services/reorder.service", () => ({
  reorderFromOrder: (...args: unknown[]) => mockReorderFromOrder(...args),
}));

vi.mock("@/lib/session-request", () => ({
  getMennyuSessionIdForRequest: (...args: unknown[]) => mockGetMennyuSessionIdForRequest(...args),
}));

import { createCustomerOrderAccessToken } from "@/lib/customer-order-access-token";
import { getOrdersForSignedInUserAction, reorderFromOrderAction } from "@/actions/order.actions";

describe("getOrdersForSignedInUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrdersForSignedInUser.mockResolvedValue([]);
  });

  it("rejects without signed-in User", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getOrdersForSignedInUserAction();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/sign in/i);
  });

  it("lists orders for signed-in user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user_1", email: "customer@example.com" },
    });
    mockGetOrdersForSignedInUser.mockResolvedValue([{ id: "ord_1" }]);

    const result = await getOrdersForSignedInUserAction();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orders).toHaveLength(1);
    }
    expect(mockGetOrdersForSignedInUser).toHaveBeenCalledWith("user_1", "customer@example.com");
  });
});

describe("reorderFromOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMennyuSessionIdForRequest.mockResolvedValue("mennyu_sess");
    mockReorderFromOrder.mockResolvedValue({ success: true, cartId: "cart_1" });
    mockAssertCustomerOrderAccess.mockResolvedValue({ ok: true, orderId: "ord_1", customerPhone: "+15551234567" });
    mockPrismaFindUnique.mockResolvedValue({
      id: "ord_1",
      customerAccountId: "ca_1",
      customerEmail: "customer@example.com",
    });
    mockUserCanAccessOrder.mockResolvedValue(true);
  });

  it("requires signed-in user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await reorderFromOrderAction("ord_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("SIGN_IN_REQUIRED");
  });

  it("rejects when user does not own the order", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user_1", email: "customer@example.com" },
    });
    mockUserCanAccessOrder.mockResolvedValue(false);

    const result = await reorderFromOrderAction("ord_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("ACCESS_DENIED");
  });

  it("allows reorder for owned order with cart session", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user_1", email: "customer@example.com" },
    });

    const token = createCustomerOrderAccessToken("ord_1");
    const result = await reorderFromOrderAction("ord_1", token);

    expect(result.success).toBe(true);
    expect(mockReorderFromOrder).toHaveBeenCalledWith("ord_1", "mennyu_sess");
  });
});
