import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  validateAccountEmail,
  validateAccountPassword,
} from "@/lib/auth/password-policy";

describe("password-policy", () => {
  it("matches registration minimum password length", () => {
    expect(validateAccountPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/8 characters/);
    expect(validateAccountPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("validates email shape", () => {
    expect(validateAccountEmail("not-an-email")).toMatch(/valid email/);
    expect(validateAccountEmail("user@example.com")).toBeNull();
  });
});
