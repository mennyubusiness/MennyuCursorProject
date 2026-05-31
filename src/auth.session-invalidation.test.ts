import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/password-session-version.server", () => ({
  loadUserPasswordChangedAtMs: vi.fn(),
}));

import { loadUserPasswordChangedAtMs } from "@/lib/auth/password-session-version.server";
import {
  isJwtSessionValidForPasswordVersion,
  passwordChangedAtToJwtMs,
} from "@/lib/auth/password-session-version";

describe("auth session invalidation after password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores passwordChangedAtMs on sign-in from user.passwordChangedAt", () => {
    const resetAt = new Date("2026-05-31T12:00:00.000Z");
    const user = {
      id: "user_1",
      passwordChangedAt: resetAt,
    };
    const passwordChangedAtMs = passwordChangedAtToJwtMs(user.passwordChangedAt);
    expect(passwordChangedAtMs).toBe(resetAt.getTime());
  });

  it("invalidates JWT when DB passwordChangedAt differs from token snapshot", async () => {
    const resetMs = new Date("2026-05-31T12:00:00.000Z").getTime();
    const token = { sub: "user_1", passwordChangedAtMs: null as number | null };

    vi.mocked(loadUserPasswordChangedAtMs).mockResolvedValue(resetMs);

    const dbMs = await loadUserPasswordChangedAtMs(token.sub);
    expect(isJwtSessionValidForPasswordVersion(token.passwordChangedAtMs, dbMs)).toBe(false);
  });

  it("accepts JWT after fresh login when token matches DB passwordChangedAt", async () => {
    const resetMs = new Date("2026-05-31T12:00:00.000Z").getTime();
    vi.mocked(loadUserPasswordChangedAtMs).mockResolvedValue(resetMs);

    const dbMs = await loadUserPasswordChangedAtMs("user_1");
    expect(isJwtSessionValidForPasswordVersion(resetMs, dbMs)).toBe(true);
  });

  it("leaves legacy users valid when passwordChangedAt is null everywhere", async () => {
    vi.mocked(loadUserPasswordChangedAtMs).mockResolvedValue(null);
    const dbMs = await loadUserPasswordChangedAtMs("legacy_user");
    expect(isJwtSessionValidForPasswordVersion(null, dbMs)).toBe(true);
  });
});
