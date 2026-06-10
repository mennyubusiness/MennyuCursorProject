import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAssertCartSessionAccess = vi.fn();
const mockResolveCheckoutPhoneForOrder = vi.fn();
const mockRecordSmsOptIn = vi.fn();
const mockCreateCustomerSessionCookieForAccount = vi.fn();
const mockAuth = vi.fn();
const mockCreateOrderFromCart = vi.fn();
const mockCreatePaymentIntent = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
}));

vi.mock("@/lib/customer-checkout-phone-verification", () => ({
  resolveCheckoutPhoneForOrder: (...args: unknown[]) => mockResolveCheckoutPhoneForOrder(...args),
  createCustomerSessionCookieForAccount: (...args: unknown[]) =>
    mockCreateCustomerSessionCookieForAccount(...args),
}));

vi.mock("@/lib/sms-opt-out.service", () => ({
  recordSmsOptIn: (...args: unknown[]) => mockRecordSmsOptIn(...args),
}));

vi.mock("@/lib/customer-order-access-token", () => ({
  createCustomerOrderAccessToken: () => "token_test",
}));

vi.mock("@/services/order.service", () => ({
  createOrderFromCart: (...args: unknown[]) => mockCreateOrderFromCart(...args),
  OrderValidationError: class OrderValidationError extends Error {},
}));

vi.mock("@/services/payment.service", () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
}));

vi.mock("@/services/customer-account-link.service", () => ({
  linkCheckoutCustomerAccountToUser: vi.fn().mockResolvedValue({ ok: true, alreadyLinked: true }),
}));

import { POST } from "./route";

const CART_ID = "cart_1";
const SESSION_A = "sess_a";

const checkoutBody = {
  cartId: CART_ID,
  customerPhone: "+15551234567",
  tipCents: 0,
  idempotencyKey: "idem_1",
};

function checkoutRequest(sessionId?: string, customerSessionCookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookies: string[] = [];
  if (sessionId) cookies.push(`mennyu_session=${encodeURIComponent(sessionId)}`);
  if (customerSessionCookie) {
    cookies.push(`mennyu_customer=${encodeURIComponent(customerSessionCookie)}`);
  }
  if (cookies.length) headers.cookie = cookies.join("; ");
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(checkoutBody),
  });
}

describe("POST /api/checkout customer session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: SESSION_A,
      podId: "pod_1",
      isGroupOrder: false,
    });
  });

  it("rejects checkout without verified customer session", async () => {
    mockResolveCheckoutPhoneForOrder.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
      code: "CUSTOMER_SESSION_REQUIRED",
    });

    const res = await POST(checkoutRequest(SESSION_A));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("CUSTOMER_SESSION_REQUIRED");
    expect(mockCreateOrderFromCart).not.toHaveBeenCalled();
  });

  it("rejects checkout when submitted phone does not match verified account", async () => {
    mockResolveCheckoutPhoneForOrder.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Phone must match your verified number. Verify your phone again if you changed it.",
      code: "PHONE_MISMATCH",
    });

    const res = await POST(checkoutRequest(SESSION_A, "tok"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("PHONE_MISMATCH");
    expect(mockCreateOrderFromCart).not.toHaveBeenCalled();
  });

  it("checks out with verified customer session and sets customerAccountId", async () => {
    mockResolveCheckoutPhoneForOrder.mockResolvedValue({
      ok: true,
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
    });
    mockCreateOrderFromCart.mockResolvedValue({
      order: { id: "ord_1", totalCents: 1000, customerPhone: "+15551234567" },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      clientSecret: "cs_test",
      paymentIntentId: "pi_test",
    });

    const res = await POST(checkoutRequest(SESSION_A, "tok"));

    expect(res.status).toBe(200);
    expect(mockCreateOrderFromCart).toHaveBeenCalledWith(
      expect.objectContaining({
        cartId: CART_ID,
        customerAccountId: "acct_1",
        customerPhone: "+15551234567",
        mennyuSessionId: SESSION_A,
      })
    );
  });

  it("checks out for signed-in user via linked account phone without customer session cookie", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_1", email: "a@b.com" } });
    mockResolveCheckoutPhoneForOrder.mockResolvedValue({
      ok: true,
      customerAccountId: "acct_linked",
      phoneE164: "+15551234567",
      establishCustomerSession: true,
    });
    mockCreateCustomerSessionCookieForAccount.mockResolvedValue("session_tok");
    mockCreateOrderFromCart.mockResolvedValue({
      order: { id: "ord_1", totalCents: 1000, customerPhone: "+15551234567" },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      clientSecret: "cs_test",
      paymentIntentId: "pi_test",
    });

    const res = await POST(checkoutRequest(SESSION_A));
    const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get("Set-Cookie") ?? ""];

    expect(res.status).toBe(200);
    expect(mockCreateOrderFromCart).toHaveBeenCalledWith(
      expect.objectContaining({
        customerAccountId: "acct_linked",
        customerPhone: "+15551234567",
      })
    );
    const cookieBlob = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(cookieBlob).toContain("mennyu_customer=");
  });
});

describe("POST /api/checkout cart session ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockResolveCheckoutPhoneForOrder.mockResolvedValue({
      ok: true,
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
    });
    mockCreatePaymentIntent.mockResolvedValue({
      clientSecret: "cs_test",
      paymentIntentId: "pi_test",
    });
  });

  it("rejects checkout when cart session does not match", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Cart not found or access denied",
    });

    const res = await POST(checkoutRequest(SESSION_A));

    expect(res.status).toBe(403);
    expect(mockCreateOrderFromCart).not.toHaveBeenCalled();
  });

  it("checks out solo cart for matching session", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: SESSION_A,
      podId: "pod_1",
      isGroupOrder: false,
    });
    mockCreateOrderFromCart.mockResolvedValue({
      order: { id: "ord_1", totalCents: 1000 },
    });

    const res = await POST(checkoutRequest(SESSION_A));

    expect(res.status).toBe(200);
    expect(mockCreateOrderFromCart).toHaveBeenCalledWith(
      expect.objectContaining({
        cartId: CART_ID,
        mennyuSessionId: SESSION_A,
      })
    );
  });

  it("rejects group checkout for non-host", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Only the host can check out for this group order.",
    });

    const res = await POST(checkoutRequest(SESSION_A));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("GROUP_ORDER_HOST_CHECKOUT");
    expect(mockCreateOrderFromCart).not.toHaveBeenCalled();
  });
});
