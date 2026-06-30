import { describe, expect, it } from "vitest";
import {
  formatCentsToCurrency,
  formatCentsToMenuPrice,
  normalizeMenuPriceDraft,
  parseMenuPriceToCents,
} from "@/lib/menu-price";

describe("parseMenuPriceToCents", () => {
  it("accepts whole dollars without decimals", () => {
    expect(parseMenuPriceToCents("12")).toEqual({ ok: true, cents: 1200 });
    expect(parseMenuPriceToCents("$12")).toEqual({ ok: true, cents: 1200 });
  });

  it("accepts one- and two-decimal prices", () => {
    expect(parseMenuPriceToCents("12.5")).toEqual({ ok: true, cents: 1250 });
    expect(parseMenuPriceToCents("12.50")).toEqual({ ok: true, cents: 1250 });
    expect(parseMenuPriceToCents("0.99")).toEqual({ ok: true, cents: 99 });
  });

  it("accepts trailing dot and zero", () => {
    expect(parseMenuPriceToCents("12.")).toEqual({ ok: true, cents: 1200 });
    expect(parseMenuPriceToCents("0")).toEqual({ ok: true, cents: 0 });
  });

  it("rejects invalid input", () => {
    expect(parseMenuPriceToCents("-1").ok).toBe(false);
    expect(parseMenuPriceToCents("abc").ok).toBe(false);
    expect(parseMenuPriceToCents("12.999").ok).toBe(false);
    expect(parseMenuPriceToCents("").ok).toBe(false);
  });
});

describe("formatCentsToMenuPrice", () => {
  it("formats without forcing trailing zeroes for whole dollars", () => {
    expect(formatCentsToMenuPrice(1200)).toBe("12");
    expect(formatCentsToMenuPrice(1250)).toBe("12.5");
    expect(formatCentsToMenuPrice(1255)).toBe("12.55");
    expect(formatCentsToMenuPrice(99)).toBe("0.99");
  });
});

describe("formatCentsToCurrency", () => {
  it("formats as USD currency", () => {
    expect(formatCentsToCurrency(1200)).toBe("$12.00");
    expect(formatCentsToCurrency(1250)).toBe("$12.50");
  });
});

describe("normalizeMenuPriceDraft", () => {
  it("normalizes valid drafts on blur", () => {
    expect(normalizeMenuPriceDraft("12")).toBe("12");
    expect(normalizeMenuPriceDraft("12.5")).toBe("12.5");
    expect(normalizeMenuPriceDraft("12.50")).toBe("12.5");
  });
});
