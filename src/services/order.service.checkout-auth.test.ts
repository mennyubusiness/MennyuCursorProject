import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockAssertCartSessionAccess = vi.fn();
const mockGroupSessionFindUnique = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockOrderFindFirst = vi.fn();
const mockCartFindUnique = vi.fn();

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      findFirst: (...args: unknown[]) => mockOrderFindFirst(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupSessionFindUnique(...args),
    },
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
    },
  },
}));

vi.mock("@/services/group-order-checkout-fingerprint.service", () => ({
  groupCheckoutFingerprintsMatch: vi.fn(),
}));

const CART_ID = "cart_account";
const SESSION_CURRENT = "sess_after_sign_in";
const ACCOUNT_USER = "user_customer";

const baseInput = {
  cartId: CART_ID,
  customerPhone: "+15551234567",
  tipCents: 0,
  idempotencyKey: "idem_checkout_auth",
  mennyuSessionId: SESSION_CURRENT,
};

describe("createOrderFromCart checkout auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindUnique.mockResolvedValue(null);
    mockOrderFindFirst.mockResolvedValue(null);
    mockGroupSessionFindUnique.mockResolvedValue(null);
    mockCartFindUnique.mockResolvedValue(null);
  });

  it("passes authUserId to assertCartSessionAccess for account-owned solo cart with mismatched session", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: "sess_old",
      podId: "pod_1",
      isGroupOrder: false,
    });

    const { createOrderFromCart, OrderValidationError } = await import("./order.service");

    await expect(
      createOrderFromCart({
        ...baseInput,
        authUserId: ACCOUNT_USER,
      })
    ).rejects.toMatchObject({ code: "CART_EMPTY" });

    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_CURRENT, {
      authUserId: ACCOUNT_USER,
      mode: "checkout",
      participantMarkers: null,
    });
    expect(OrderValidationError).toBeDefined();
  });

  it("denies solo checkout when authUserId is missing and session access fails (guest path)", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Cart not found or access denied",
    });

    const { createOrderFromCart } = await import("./order.service");

    await expect(
      createOrderFromCart({
        ...baseInput,
        authUserId: null,
      })
    ).rejects.toMatchObject({ code: "CART_ACCESS_DENIED" });

    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_CURRENT, {
      authUserId: null,
      mode: "checkout",
      participantMarkers: null,
    });
  });

  it("uses groupOrderHostUserId for group checkout when authUserId is omitted", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: SESSION_CURRENT,
      podId: "pod_1",
      isGroupOrder: true,
    });
    mockGroupSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "locked_checkout" });

    const { createOrderFromCart } = await import("./order.service");

    await expect(
      createOrderFromCart({
        ...baseInput,
        groupOrderHostUserId: "user_host",
        groupCheckoutFingerprint: "fp_test",
      })
    ).rejects.not.toMatchObject({ code: "CART_ACCESS_DENIED" });

    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_CURRENT, {
      authUserId: "user_host",
      mode: "checkout",
      participantMarkers: null,
    });
  });

  it("prefers authUserId over groupOrderHostUserId when both are set", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: SESSION_CURRENT,
      podId: "pod_1",
      isGroupOrder: true,
    });
    mockGroupSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "locked_checkout" });

    const { createOrderFromCart } = await import("./order.service");

    await expect(
      createOrderFromCart({
        ...baseInput,
        authUserId: ACCOUNT_USER,
        groupOrderHostUserId: "user_host",
        groupCheckoutFingerprint: "fp_test",
      })
    ).rejects.not.toMatchObject({ code: "CART_ACCESS_DENIED" });

    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_CURRENT, {
      authUserId: ACCOUNT_USER,
      mode: "checkout",
      participantMarkers: null,
    });
  });
});
