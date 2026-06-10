import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockRemovePhoneFromUserAccount = vi.fn();
const mockRevokeCustomerSessionFromRequest = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/services/customer-account-phone.service", () => ({
  removePhoneFromUserAccount: (...args: unknown[]) => mockRemovePhoneFromUserAccount(...args),
}));

vi.mock("@/lib/customer-session", () => ({
  revokeCustomerSessionFromRequest: (...args: unknown[]) =>
    mockRevokeCustomerSessionFromRequest(...args),
  buildClearCustomerSessionCookieHeader: () =>
    "mennyu_customer=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
}));

import { POST } from "./route";

describe("POST /api/customer/account/phone/remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user_1" } });
    mockRemovePhoneFromUserAccount.mockResolvedValue({
      ok: true,
      removedPhoneE164: "+15551234567",
    });
    mockRevokeCustomerSessionFromRequest.mockResolvedValue(undefined);
  });

  it("requires sign-in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(new NextRequest("http://localhost/api/customer/account/phone/remove", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("removes phone, clears session cookie", async () => {
    const res = await POST(new NextRequest("http://localhost/api/customer/account/phone/remove", { method: "POST" }));
    const setCookie = res.headers.get("Set-Cookie") ?? "";

    expect(res.status).toBe(200);
    expect(mockRemovePhoneFromUserAccount).toHaveBeenCalledWith("user_1");
    expect(mockRevokeCustomerSessionFromRequest).toHaveBeenCalled();
    expect(setCookie).toContain("mennyu_customer=");
  });
});
