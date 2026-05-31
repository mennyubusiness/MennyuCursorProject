import { describe, expect, it } from "vitest";

import {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  hashPasswordResetToken,
  isUrlSafePasswordResetToken,
  normalizePasswordResetTokenFromRequest,
} from "@/lib/auth/password-reset-token";

describe("password-reset-token", () => {
  it("generates URL-safe tokens without +, /, or =", () => {
    for (let i = 0; i < 50; i++) {
      const token = generatePasswordResetToken();
      expect(token).not.toMatch(/[+/=]/);
      expect(isUrlSafePasswordResetToken(token)).toBe(true);
    }
  });

  it("hashes the exact token string", () => {
    const token = generatePasswordResetToken();
    const hash1 = hashPasswordResetToken(token);
    const hash2 = hashPasswordResetToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });

  it("repairs space-to-plus corruption for legacy base64 tokens", () => {
    const legacy = "abc+def/ghi=";
    expect(normalizePasswordResetTokenFromRequest("abc def/ghi=")).toBe(legacy);
  });

  it("buildPasswordResetUrl embeds the exact token", () => {
    const token = generatePasswordResetToken();
    const url = buildPasswordResetUrl("https://app.example.com", token);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("token")).toBe(token);
    expect(url).not.toContain("+");
  });
});
