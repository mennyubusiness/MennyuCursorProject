import { describe, expect, it } from "vitest";

import {
  buildEmailVerificationUrl,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  isUrlSafeEmailVerificationToken,
  normalizeEmailVerificationTokenFromRequest,
} from "@/lib/auth/email-verification-token";

describe("email-verification-token", () => {
  it("generates URL-safe tokens without +, /, or =", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateEmailVerificationToken();
      expect(token).not.toMatch(/[+/=]/);
      expect(isUrlSafeEmailVerificationToken(token)).toBe(true);
    }
  });

  it("hashes the exact token string", () => {
    const token = generateEmailVerificationToken();
    const hash1 = hashEmailVerificationToken(token);
    const hash2 = hashEmailVerificationToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });

  it("repairs space-to-plus corruption for legacy base64 tokens", () => {
    const legacy = "abc+def/ghi=";
    expect(normalizeEmailVerificationTokenFromRequest("abc def/ghi=")).toBe(legacy);
  });

  it("buildEmailVerificationUrl embeds the exact token", () => {
    const token = generateEmailVerificationToken();
    const url = buildEmailVerificationUrl("https://app.example.com", token);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/verify-email");
    expect(parsed.searchParams.get("token")).toBe(token);
  });
});
