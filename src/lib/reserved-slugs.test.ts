import { describe, expect, it } from "vitest";

import {
  RESERVED_PUBLIC_SLUGS,
  assertSlugNotReserved,
  isReservedPublicSlug,
} from "./reserved-slugs";

describe("reserved-slugs", () => {
  it("includes required first-party route segments", () => {
    for (const slug of [
      "cart",
      "checkout",
      "account",
      "admin",
      "vendor",
      "pod",
      "api",
      "about",
      "faq",
      "orders",
      "privacy",
      "terms",
      "sms-consent",
      "sign-in",
      "sign-up",
    ]) {
      expect(RESERVED_PUBLIC_SLUGS).toContain(slug);
      expect(isReservedPublicSlug(slug)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isReservedPublicSlug("CART")).toBe(true);
    expect(isReservedPublicSlug("  Checkout  ")).toBe(true);
  });

  it("allows customer pod slugs", () => {
    expect(isReservedPublicSlug("willamette-garage")).toBe(false);
    expect(isReservedPublicSlug("billys-jams-and-crams")).toBe(false);
  });

  it("assertSlugNotReserved throws for reserved slugs", () => {
    expect(() => assertSlugNotReserved("cart", "Pod slug")).toThrow(/reserved/i);
  });
});
