import { NextResponse } from "next/server";

import {
  RATE_LIMIT_ERROR_CODE,
  RATE_LIMIT_ERROR_MESSAGE,
  enforceRateLimits,
  type RateLimitCheck,
} from "@/lib/rate-limit";

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}

export function rateLimitedJsonResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: RATE_LIMIT_ERROR_MESSAGE, code: RATE_LIMIT_ERROR_CODE },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSec)) },
    }
  );
}

/** Returns a 429 response when limited, otherwise null. */
export function applyRateLimits(checks: RateLimitCheck[]): NextResponse | null {
  const blocked = enforceRateLimits(checks);
  if (!blocked) return null;
  return rateLimitedJsonResponse(blocked.retryAfterSec);
}

export function isRateLimited(checks: RateLimitCheck[]): boolean {
  return enforceRateLimits(checks) !== null;
}
