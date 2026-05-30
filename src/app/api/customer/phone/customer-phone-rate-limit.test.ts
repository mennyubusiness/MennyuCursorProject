import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSendPhoneVerificationCode = vi.fn();
const mockVerifyPhoneVerificationCode = vi.fn();

vi.mock("@/services/customer-phone-otp.service", () => ({
  sendPhoneVerificationCode: (...args: unknown[]) => mockSendPhoneVerificationCode(...args),
  verifyPhoneVerificationCode: (...args: unknown[]) => mockVerifyPhoneVerificationCode(...args),
}));

import { resetRateLimitStoreForTests } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { POST as sendCodePost } from "./send-code/route";
import { POST as verifyCodePost } from "./verify-code/route";

describe("OTP route rate limits", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_TEST = "1";
    resetRateLimitStoreForTests();
    vi.clearAllMocks();
    mockSendPhoneVerificationCode.mockResolvedValue({
      ok: true,
      message: "If this number can receive texts, we sent a verification code.",
    });
    mockVerifyPhoneVerificationCode.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Incorrect code. Try again.",
    });
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_TEST;
    resetRateLimitStoreForTests();
  });

  it("send-code returns 429 after phone window is exceeded", async () => {
    for (let i = 0; i < RATE_LIMITS.otpSendPhone.limit; i++) {
      const okRes = await sendCodePost(
        new NextRequest("http://localhost/api/customer/phone/send-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "1.1.1.1",
          },
          body: JSON.stringify({ phone: "5551234567" }),
        })
      );
      expect(okRes.status).toBe(200);
    }

    const limited = await sendCodePost(
      new NextRequest("http://localhost/api/customer/phone/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "1.1.1.1",
        },
        body: JSON.stringify({ phone: "5551234567" }),
      })
    );
    const body = await limited.json();
    expect(limited.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(mockSendPhoneVerificationCode).toHaveBeenCalledTimes(RATE_LIMITS.otpSendPhone.limit);
  });

  it("verify-code returns 429 after phone verify window is exceeded", async () => {
    for (let i = 0; i < RATE_LIMITS.otpVerifyPhone.limit; i++) {
      await verifyCodePost(
        new NextRequest("http://localhost/api/customer/phone/verify-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "2.2.2.2",
          },
          body: JSON.stringify({ phone: "5551234567", code: "000000" }),
        })
      );
    }

    const limited = await verifyCodePost(
      new NextRequest("http://localhost/api/customer/phone/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "2.2.2.2",
        },
        body: JSON.stringify({ phone: "5551234567", code: "000000" }),
      })
    );
    const body = await limited.json();
    expect(limited.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(mockVerifyPhoneVerificationCode).toHaveBeenCalledTimes(RATE_LIMITS.otpVerifyPhone.limit);
  });
});
