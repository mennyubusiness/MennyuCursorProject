import { describe, expect, it } from "vitest";

import {
  isJwtSessionValidForPasswordVersion,
  passwordChangedAtToJwtMs,
} from "@/lib/auth/password-session-version";

describe("password-session-version", () => {
  it("maps null passwordChangedAt to null JWT ms", () => {
    expect(passwordChangedAtToJwtMs(null)).toBeNull();
    expect(passwordChangedAtToJwtMs(undefined)).toBeNull();
  });

  it("accepts legacy sessions when DB and token both have null password version", () => {
    expect(isJwtSessionValidForPasswordVersion(null, null)).toBe(true);
    expect(isJwtSessionValidForPasswordVersion(undefined, undefined)).toBe(true);
  });

  it("rejects sessions issued before password reset", () => {
    const resetAt = new Date("2026-05-31T12:00:00.000Z");
    const resetMs = resetAt.getTime();
    expect(isJwtSessionValidForPasswordVersion(null, resetMs)).toBe(false);
    expect(isJwtSessionValidForPasswordVersion(resetMs - 1000, resetMs)).toBe(false);
  });

  it("accepts sessions issued after password reset", () => {
    const resetMs = new Date("2026-05-31T12:00:00.000Z").getTime();
    expect(isJwtSessionValidForPasswordVersion(resetMs, resetMs)).toBe(true);
  });

  it("rejects sessions after a second password change", () => {
    const firstReset = new Date("2026-05-31T12:00:00.000Z").getTime();
    const secondReset = new Date("2026-06-01T12:00:00.000Z").getTime();
    expect(isJwtSessionValidForPasswordVersion(firstReset, secondReset)).toBe(false);
    expect(isJwtSessionValidForPasswordVersion(secondReset, secondReset)).toBe(true);
  });
});
