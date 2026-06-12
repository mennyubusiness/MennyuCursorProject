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
});
