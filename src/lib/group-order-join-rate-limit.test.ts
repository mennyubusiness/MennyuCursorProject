import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnforceRateLimits = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    groupJoinCodeLookupIp: { limit: 20, windowMs: 600_000 },
  },
  rateLimitKeys: {
    groupJoinCodeLookupIp: (ip: string) => `group:join:code-lookup:ip:${ip}`,
  },
  enforceRateLimits: (...args: unknown[]) => mockEnforceRateLimits(...args),
}));

import { isGroupJoinCodeLookupRateLimited } from "@/lib/group-order-join-rate-limit";

describe("group-order-join-rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimits.mockReturnValue(false);
  });

  it("returns false when under the lookup limit", () => {
    expect(isGroupJoinCodeLookupRateLimited("127.0.0.1")).toBe(false);
    expect(mockEnforceRateLimits).toHaveBeenCalledTimes(1);
  });

  it("returns true when lookup limit exceeded", () => {
    mockEnforceRateLimits.mockReturnValue({ retryAfterSec: 30 });
    expect(isGroupJoinCodeLookupRateLimited("127.0.0.1")).toBe(true);
  });
});
