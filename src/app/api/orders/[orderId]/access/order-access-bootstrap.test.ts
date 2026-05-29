import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockResolveBootstrap = vi.fn();
const mockBuildCookieHeaders = vi.fn();

vi.mock("@/lib/customer-order-access", () => ({
  resolveCustomerOrderAccessBootstrap: (...args: unknown[]) => mockResolveBootstrap(...args),
  buildPersistedCustomerOrderAccessCookieHeaders: (...args: unknown[]) =>
    mockBuildCookieHeaders(...args),
}));

import { GET } from "./route";

const ORDER_ID = "ord_1";
const TOKEN = "token_signed";

describe("GET /api/orders/[orderId]/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCookieHeaders.mockReturnValue([
      "mennyu_customer_phone=%2B15551234567; Path=/; HttpOnly",
      "mennyu_order_access=token_signed; Path=/; HttpOnly",
    ]);
  });

  it("sets cookies and redirects to order page without access param", async () => {
    mockResolveBootstrap.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      customerPhone: "+15551234567",
    });

    const req = new NextRequest(
      `http://localhost/api/orders/${ORDER_ID}/access?access=${encodeURIComponent(TOKEN)}`
    );
    const res = await GET(req, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`http://localhost/order/${ORDER_ID}`);
    expect(mockResolveBootstrap).toHaveBeenCalledWith(ORDER_ID, TOKEN);
    expect(mockBuildCookieHeaders).toHaveBeenCalledWith(TOKEN, "+15551234567");
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves payment and from params on redirect", async () => {
    mockResolveBootstrap.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      customerPhone: "+15551234567",
    });

    const req = new NextRequest(
      `http://localhost/api/orders/${ORDER_ID}/access?access=${encodeURIComponent(TOKEN)}&payment=success&from=checkout`
    );
    const res = await GET(req, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(res.headers.get("location")).toBe(
      `http://localhost/order/${ORDER_ID}?from=checkout&payment=success`
    );
  });

  it("does not set cookies when token is invalid", async () => {
    mockResolveBootstrap.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Invalid or expired order access link.",
    });

    const req = new NextRequest(
      `http://localhost/api/orders/${ORDER_ID}/access?access=bad-token`
    );
    const res = await GET(req, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`http://localhost/order/${ORDER_ID}`);
    expect(mockBuildCookieHeaders).not.toHaveBeenCalled();
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies).toHaveLength(0);
  });

  it("redirects to order page when access param is missing", async () => {
    const req = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/access`);
    const res = await GET(req, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`http://localhost/order/${ORDER_ID}`);
    expect(mockResolveBootstrap).not.toHaveBeenCalled();
  });
});
