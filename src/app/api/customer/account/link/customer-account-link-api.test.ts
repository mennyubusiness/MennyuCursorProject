import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockAssertCustomerSession = vi.fn();
const mockLinkCheckout = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/customer-session", () => ({
  assertCustomerSession: (...args: unknown[]) => mockAssertCustomerSession(...args),
}));

vi.mock("@/services/customer-account-link.service", () => ({
  linkCheckoutCustomerAccountToUser: (...args: unknown[]) => mockLinkCheckout(...args),
}));

import { POST } from "./route";

describe("POST /api/customer/account/link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user_1", email: "a@example.com" } });
    mockAssertCustomerSession.mockResolvedValue({
      ok: true,
      customerAccountId: "ca_1",
      phoneE164: "+15551234567",
    });
  });

  it("rejects without signed-in User", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(new NextRequest("http://localhost/api/customer/account/link", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("SIGN_IN_REQUIRED");
    expect(mockLinkCheckout).not.toHaveBeenCalled();
  });

  it("rejects without verified CustomerSession", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
    });

    const res = await POST(new NextRequest("http://localhost/api/customer/account/link", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("NO_CUSTOMER_SESSION");
  });

  it("links CustomerAccount for signed-in user with session", async () => {
    mockLinkCheckout.mockResolvedValue({
      ok: true,
      alreadyLinked: false,
      legacyOrdersAttached: 1,
    });

    const res = await POST(new NextRequest("http://localhost/api/customer/account/link", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockLinkCheckout).toHaveBeenCalledWith({
      userId: "user_1",
      customerAccountId: "ca_1",
      phoneE164: "+15551234567",
    });
  });

  it("returns 409 when phone linked to another account", async () => {
    mockLinkCheckout.mockResolvedValue({
      ok: false,
      code: "ALREADY_LINKED_OTHER",
      error: "This phone is already linked to another account.",
    });

    const res = await POST(new NextRequest("http://localhost/api/customer/account/link", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("ALREADY_LINKED_OTHER");
  });
});
