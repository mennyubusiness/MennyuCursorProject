import { enforceRateLimits, RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";

/** Rate-limit join-code lookups (validate action, join page SSR, server lookups). */
export function isGroupJoinCodeLookupRateLimited(ip: string): boolean {
  return Boolean(
    enforceRateLimits([
      {
        key: rateLimitKeys.groupJoinCodeLookupIp(ip),
        ...RATE_LIMITS.groupJoinCodeLookupIp,
      },
    ])
  );
}
