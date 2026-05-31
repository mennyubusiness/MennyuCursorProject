import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/rate-limit-http", () => ({
  getClientIpFromHeaders: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOrigin: vi.fn().mockResolvedValue("https://app.example.com"),
}));

const mockRequestPasswordReset = vi.fn();
const mockResetPasswordWithToken = vi.fn();

vi.mock("@/services/password-reset.service", () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  resetPasswordWithToken: (...args: unknown[]) => mockResetPasswordWithToken(...args),
}));

import { headers } from "next/headers";
import {
  RATE_LIMITS,
  resetRateLimitStoreForTests,
} from "@/lib/rate-limit";
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/actions/password-reset.actions";

describe("password-reset.actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStoreForTests();
    process.env.RATE_LIMIT_TEST = "1";
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    mockRequestPasswordReset.mockResolvedValue({ ok: true, message: "sent" });
    mockResetPasswordWithToken.mockResolvedValue({ ok: true, message: "reset" });
  });

  it("rate limits forgot-password requests by email", async () => {
    const email = "user@example.com";

    for (let i = 0; i < RATE_LIMITS.passwordResetRequestEmail.limit; i++) {
      const result = await requestPasswordResetAction(email);
      expect(result.ok).toBe(true);
    }

    const blocked = await requestPasswordResetAction(email);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain("Too many attempts");
    }
  });

  it("delegates reset to service with rate limit on IP", async () => {
    const result = await resetPasswordAction("token123", "newpassword1");
    expect(result.ok).toBe(true);
    expect(mockResetPasswordWithToken).toHaveBeenCalledWith("token123", "newpassword1");
  });
});
