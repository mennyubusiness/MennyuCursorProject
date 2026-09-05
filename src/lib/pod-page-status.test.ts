import { describe, expect, it } from "vitest";
import { getPodOrderingStatus } from "./pod-page-status";

describe("getPodOrderingStatus", () => {
  it("returns empty when no vendors", () => {
    expect(getPodOrderingStatus([])).toMatchObject({ tone: "empty", openVendorCount: 0 });
  });

  it("returns closed when all vendors unavailable", () => {
    expect(getPodOrderingStatus([{ unavailable: true }, { unavailable: true }])).toMatchObject({
      tone: "closed",
      openVendorCount: 0,
      totalVendorCount: 2,
    });
  });

  it("returns limited when some vendors open", () => {
    expect(getPodOrderingStatus([{ unavailable: false }, { unavailable: true }])).toMatchObject({
      tone: "limited",
      openVendorCount: 1,
      totalVendorCount: 2,
    });
  });

  it("returns open when all vendors available", () => {
    expect(getPodOrderingStatus([{ unavailable: false }])).toMatchObject({
      tone: "open",
      label: "Open for orders",
    });
  });

  /** A pod where nothing is meant to be orderable is a browsing destination, not a closed one. */
  it("returns a neutral browse status when every vendor is menu-only", () => {
    expect(
      getPodOrderingStatus([
        { unavailable: false, menuOnly: true },
        { unavailable: false, menuOnly: true },
      ])
    ).toMatchObject({
      tone: "menu_only",
      label: "Browse menus",
      openVendorCount: 0,
      totalVendorCount: 2,
    });
  });

  it("counts only ordering-intent vendors in a mixed pod", () => {
    expect(
      getPodOrderingStatus([
        { unavailable: false },
        { unavailable: false, menuOnly: true },
        { unavailable: false, menuOnly: true },
      ])
    ).toMatchObject({
      tone: "open",
      label: "Open for orders",
      openVendorCount: 1,
      totalVendorCount: 3,
    });
  });

  it("does not let menu-only vendors make a mixed pod read as closed", () => {
    expect(
      getPodOrderingStatus([
        { unavailable: true },
        { unavailable: false, menuOnly: true },
      ])
    ).toMatchObject({ tone: "closed", openVendorCount: 0 });
    expect(
      getPodOrderingStatus([
        { unavailable: false },
        { unavailable: true },
        { unavailable: false, menuOnly: true },
      ])
    ).toMatchObject({ tone: "limited", label: "1 of 2 vendors open" });
  });
});
