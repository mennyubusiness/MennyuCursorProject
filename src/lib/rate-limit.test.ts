import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RATE_LIMITS,
  consumeRateLimit,
  enforceRateLimits,
  isRateLimitDisabled,
  rateLimitKeys,
  resetRateLimitStoreForTests,
} from "./rate-limit";

describe("rate-limit core", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_TEST = "1";
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_TEST;
    resetRateLimitStoreForTests();
  });

  it("allows requests under the limit", () => {
    const key = rateLimitKeys.otpSendPhone("+15551234567");
    for (let i = 0; i < RATE_LIMITS.otpSendPhone.limit; i++) {
      const result = consumeRateLimit(key, RATE_LIMITS.otpSendPhone.limit, RATE_LIMITS.otpSendPhone.windowMs);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over the limit with retryAfterSec", () => {
    const key = rateLimitKeys.otpSendPhone("+15551234567");
    for (let i = 0; i < RATE_LIMITS.otpSendPhone.limit; i++) {
      consumeRateLimit(key, RATE_LIMITS.otpSendPhone.limit, RATE_LIMITS.otpSendPhone.windowMs);
    }
    const blocked = consumeRateLimit(key, RATE_LIMITS.otpSendPhone.limit, RATE_LIMITS.otpSendPhone.windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("enforceRateLimits returns null when all checks pass", () => {
    const result = enforceRateLimits([
      {
        key: rateLimitKeys.adminAccessIp("1.2.3.4"),
        ...RATE_LIMITS.adminAccess,
      },
    ]);
    expect(result).toBeNull();
  });

  it("enforceRateLimits blocks when any dimension is exceeded", () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < RATE_LIMITS.adminAccess.limit; i++) {
      enforceRateLimits([
        {
          key: rateLimitKeys.adminAccessIp(ip),
          ...RATE_LIMITS.adminAccess,
        },
      ]);
    }
    const blocked = enforceRateLimits([
      {
        key: rateLimitKeys.adminAccessIp(ip),
        ...RATE_LIMITS.adminAccess,
      },
    ]);
    expect(blocked).not.toBeNull();
    expect(blocked?.retryAfterSec).toBeGreaterThan(0);
  });

  it("is disabled in test unless RATE_LIMIT_TEST=1", () => {
    delete process.env.RATE_LIMIT_TEST;
    expect(isRateLimitDisabled()).toBe(true);
    process.env.RATE_LIMIT_TEST = "1";
    expect(isRateLimitDisabled()).toBe(false);
  });
});

describe("rate-limit-http response shape", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_TEST = "1";
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_TEST;
    resetRateLimitStoreForTests();
  });

  it("applyRateLimits returns 429 JSON with RATE_LIMITED code", async () => {
    const { applyRateLimits } = await import("./rate-limit-http");
    const ip = "10.0.0.1";
    for (let i = 0; i < RATE_LIMITS.otpVerifyPhone.limit; i++) {
      applyRateLimits([
        {
          key: rateLimitKeys.otpVerifyPhone("+15550001111"),
          ...RATE_LIMITS.otpVerifyPhone,
        },
      ]);
    }
    const res = applyRateLimits([
      {
        key: rateLimitKeys.otpVerifyPhone("+15550001111"),
        ...RATE_LIMITS.otpVerifyPhone,
      },
      {
        key: rateLimitKeys.otpVerifyIp(ip),
        ...RATE_LIMITS.otpVerifyIp,
      },
    ]);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    const body = await res!.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.error).toMatch(/Too many attempts/i);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
  });
});
