/**
 * In-memory fixed-window rate limiter (best-effort, per server instance).
 *
 * Production note: counters are not shared across instances or restarts.
 * For multi-instance deployments, replace with Redis/Upstash/Vercel KV when available.
 */

export type RateLimitCheck = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitConsumeResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export const RATE_LIMIT_ERROR_MESSAGE = "Too many attempts. Please try again later.";
export const RATE_LIMIT_ERROR_CODE = "RATE_LIMITED" as const;

/** Fixed-window limits for sensitive routes (v1). */
export const RATE_LIMITS = {
  otpSendPhone: { limit: 3, windowMs: 10 * 60 * 1000 },
  otpSendIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  otpVerifyPhone: { limit: 5, windowMs: 10 * 60 * 1000 },
  otpVerifyIp: { limit: 20, windowMs: 10 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  adminAccess: { limit: 5, windowMs: 15 * 60 * 1000 },
  adminBootstrap: { limit: 5, windowMs: 15 * 60 * 1000 },
  supportIssue: { limit: 5, windowMs: 60 * 60 * 1000 },
  checkoutSession: { limit: 10, windowMs: 10 * 60 * 1000 },
  checkoutIp: { limit: 20, windowMs: 10 * 60 * 1000 },
  orderConfirmSession: { limit: 10, windowMs: 10 * 60 * 1000 },
  groupJoinIp: { limit: 10, windowMs: 10 * 60 * 1000 },
  groupJoinSession: { limit: 10, windowMs: 10 * 60 * 1000 },
  groupJoinCodeLookupIp: { limit: 20, windowMs: 10 * 60 * 1000 },
  orderStatusPoll: { limit: 120, windowMs: 10 * 60 * 1000 },
  orderAccessBootstrap: { limit: 30, windowMs: 10 * 60 * 1000 },
  registerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  passwordResetRequestEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
  passwordResetRequestIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  passwordResetAttemptIp: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

export function isRateLimitDisabled(): boolean {
  if (process.env.RATE_LIMIT_DISABLED === "1") return true;
  if (process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_TEST !== "1") return true;
  return false;
}

export function resetRateLimitStoreForTests(): void {
  buckets.clear();
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitConsumeResult {
  if (isRateLimitDisabled()) {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: 0,
  };
}

/** Apply all checks; increments each bucket. Returns worst retry if any limit exceeded. */
export function enforceRateLimits(
  checks: RateLimitCheck[]
): { retryAfterSec: number } | null {
  if (isRateLimitDisabled() || checks.length === 0) return null;

  let blocked: { retryAfterSec: number } | null = null;
  for (const check of checks) {
    const result = consumeRateLimit(check.key, check.limit, check.windowMs);
    if (!result.allowed) {
      if (!blocked || result.retryAfterSec > blocked.retryAfterSec) {
        blocked = { retryAfterSec: result.retryAfterSec };
      }
    }
  }
  return blocked;
}

export const rateLimitKeys = {
  otpSendPhone: (phoneE164: string) => `otp:send:phone:${phoneE164}`,
  otpSendIp: (ip: string) => `otp:send:ip:${ip}`,
  otpVerifyPhone: (phoneE164: string) => `otp:verify:phone:${phoneE164}`,
  otpVerifyIp: (ip: string) => `otp:verify:ip:${ip}`,
  loginIp: (ip: string) => `login:ip:${ip}`,
  loginEmail: (email: string) => `login:email:${email.toLowerCase().trim()}`,
  adminAccessIp: (ip: string) => `admin:access:ip:${ip}`,
  adminBootstrapIp: (ip: string) => `admin:bootstrap:ip:${ip}`,
  supportIssue: (orderId: string, ip: string) => `support:issue:${orderId}:${ip}`,
  checkoutSession: (sessionId: string) => `checkout:session:${sessionId}`,
  checkoutIp: (ip: string) => `checkout:ip:${ip}`,
  orderConfirmSession: (sessionId: string) => `order:confirm:session:${sessionId}`,
  groupJoinIp: (ip: string) => `group:join:ip:${ip}`,
  groupJoinSession: (sessionId: string) => `group:join:session:${sessionId}`,
  groupJoinCodeLookupIp: (ip: string) => `group:join:code-lookup:ip:${ip}`,
  orderStatusPoll: (orderId: string, actorKey: string) => `order:status:${orderId}:${actorKey}`,
  orderAccessBootstrap: (orderId: string, ip: string) => `order:access:${orderId}:${ip}`,
  registerIp: (ip: string) => `register:ip:${ip}`,
  passwordResetRequestEmail: (email: string) => `password-reset:request:email:${email}`,
  passwordResetRequestIp: (ip: string) => `password-reset:request:ip:${ip}`,
  passwordResetAttemptIp: (ip: string) => `password-reset:attempt:ip:${ip}`,
};
