import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSendPhoneVerificationCode = vi.fn();
const mockVerifyPhoneVerificationCode = vi.fn();
const mockLinkCheckoutCustomerAccountToUser = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/services/customer-account-link.service", () => ({
  linkVerifiedPhoneToUserAfterOtp: (...args: unknown[]) =>
    mockLinkCheckoutCustomerAccountToUser(...args),
}));

vi.mock("@/services/customer-phone-otp.service", () => ({
  sendPhoneVerificationCode: (...args: unknown[]) => mockSendPhoneVerificationCode(...args),
  verifyPhoneVerificationCode: (...args: unknown[]) => mockVerifyPhoneVerificationCode(...args),
}));

import { POST as sendCodePost } from "./send-code/route";
import { POST as verifyCodePost } from "./verify-code/route";

describe("POST /api/customer/phone/verify-code cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockLinkCheckoutCustomerAccountToUser.mockResolvedValue({
      ok: true,
      alreadyLinked: false,
      legacyOrdersAttached: 0,
    });
  });

  it("verify-code success sets mennyu_customer HttpOnly cookie", async () => {
    mockVerifyPhoneVerificationCode.mockResolvedValue({
      ok: true,
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
      sessionToken: "opaque_session_token",
    });

    const req = new NextRequest("http://localhost/api/customer/phone/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "5551234567", code: "123456" }),
    });

    const res = await verifyCodePost(req);
    const setCookie = res.headers.get("Set-Cookie") ?? "";

    expect(res.status).toBe(200);
    expect(setCookie).toContain("mennyu_customer=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("links verified phone to signed-in user account", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_1", email: "a@b.com" } });
    mockVerifyPhoneVerificationCode.mockResolvedValue({
      ok: true,
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
      sessionToken: "opaque_session_token",
    });

    const req = new NextRequest("http://localhost/api/customer/phone/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "5551234567", code: "123456" }),
    });

    const res = await verifyCodePost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linkedToAccount).toBe(true);
    expect(mockLinkCheckoutCustomerAccountToUser).toHaveBeenCalledWith({
      userId: "user_1",
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
    });
  });
});

describe("POST /api/customer/phone/send-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPhoneVerificationCode.mockResolvedValue({
      ok: true,
      message: "If this number can receive texts, we sent a verification code.",
    });
  });

  it("returns generic success without leaking phone existence", async () => {
    const req = new NextRequest("http://localhost/api/customer/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "5551234567" }),
    });

    const res = await sendCodePost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/sent a verification code/i);
  });
});
