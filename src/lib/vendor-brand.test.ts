import { describe, expect, it } from "vitest";
import {
  normalizeVendorLogoUrl,
  parseSafeHexAccentColor,
  normalizeVendorDisplayName,
} from "./vendor-brand";

describe("parseSafeHexAccentColor", () => {
  it("accepts lowercase hex6", () => {
    expect(parseSafeHexAccentColor("#aabbcc")).toBe("#aabbcc");
  });
  it("normalizes case", () => {
    expect(parseSafeHexAccentColor("#AA11FF")).toBe("#aa11ff");
  });
  it("rejects rgb shorthand and invalid", () => {
    expect(parseSafeHexAccentColor("#abc")).toBeNull();
    expect(parseSafeHexAccentColor("red")).toBeNull();
    expect(parseSafeHexAccentColor("#gg0000")).toBeNull();
    expect(parseSafeHexAccentColor("")).toBeNull();
    expect(parseSafeHexAccentColor(null)).toBeNull();
  });
});

describe("normalizeVendorLogoUrl", () => {
  it("requires https", () => {
    expect(normalizeVendorLogoUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(normalizeVendorLogoUrl("http://example.com/x.png")).toBeNull();
    expect(normalizeVendorLogoUrl("")).toBeNull();
  });
});

describe("normalizeVendorDisplayName", () => {
  it("trims and rejects empty", () => {
    expect(normalizeVendorDisplayName("  Cafe  ")).toEqual({ ok: true, value: "Cafe" });
    expect(normalizeVendorDisplayName("   ").ok).toBe(false);
  });
});
