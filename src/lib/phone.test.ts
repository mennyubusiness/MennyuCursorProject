import { describe, expect, it } from "vitest";
import {
  isLikelyE164Phone,
  maskPhone,
  normalizeUsPhoneToE164,
} from "./phone";

describe("phone helpers", () => {
  it("normalizes US 10-digit to E.164", () => {
    expect(normalizeUsPhoneToE164("5551234567")).toBe("+15551234567");
    expect(normalizeUsPhoneToE164("(555) 123-4567")).toBe("+15551234567");
  });

  it("preserves E.164", () => {
    expect(normalizeUsPhoneToE164("+15551234567")).toBe("+15551234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeUsPhoneToE164("123")).toBeNull();
    expect(normalizeUsPhoneToE164("")).toBeNull();
  });

  it("masks phone for logs", () => {
    expect(maskPhone("+15551234567")).toBe("+1***4567");
  });

  it("detects E.164", () => {
    expect(isLikelyE164Phone("+15551234567")).toBe(true);
    expect(isLikelyE164Phone("555")).toBe(false);
  });
});
