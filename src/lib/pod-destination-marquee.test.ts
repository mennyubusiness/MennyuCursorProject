import { describe, expect, it } from "vitest";

import {
  buildDestinationMarqueeContent,
  cleanMarqueeLabel,
  OPEN_ORDER_MARQUEE_BANNED,
} from "./pod-destination-marquee";

const baseInput = {
  podName: "Downtown Food Pod",
  vendorNames: [] as string[],
};

describe("cleanMarqueeLabel", () => {
  it("uppercases and trims labels", () => {
    expect(cleanMarqueeLabel("  happy burger  ")).toBe("HAPPY BURGER");
  });

  it("strips unsafe markup", () => {
    expect(cleanMarqueeLabel("<b>Taco Stand</b>")).toBe("TACO STAND");
  });
});

describe("buildDestinationMarqueeContent", () => {
  it("returns vendor names when vendors exist", () => {
    const result = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["Happy Burger", "River Coffee", "Taco Stand"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items).toEqual(["HAPPY BURGER", "RIVER COFFEE", "TACO STAND"]);
  });

  it("does not use amenities or custom amenities even when many exist", () => {
    const result = buildDestinationMarqueeContent({
      podName: "Downtown Food Pod",
      vendorNames: ["Happy Burger"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items).toEqual(["HAPPY BURGER"]);
    expect(result.items).not.toContain("OUTDOOR SEATING");
    expect(result.items).not.toContain("LIVE MUSIC");
  });

  it("does not include Open Order capability copy in vendor or fallback modes", () => {
    const vendorResult = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["One Checkout Kitchen"],
    });
    const fallbackResult = buildDestinationMarqueeContent(baseInput);

    for (const banned of OPEN_ORDER_MARQUEE_BANNED) {
      expect(vendorResult.items).not.toContain(banned);
      expect(fallbackResult.items).not.toContain(banned);
    }
  });

  it("deduplicates vendor names case-insensitively", () => {
    const result = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["Happy Burger", "happy burger", "River Coffee"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items).toEqual(["HAPPY BURGER", "RIVER COFFEE"]);
  });

  it("returns fallback only when no vendor names exist", () => {
    const result = buildDestinationMarqueeContent(baseInput);

    expect(result.kind).toBe("fallback");
    expect(result.items).toContain("DOWNTOWN FOOD POD");
    expect(result.items).toContain("FOOD CARTS");
    expect(result.items).toContain("LOCAL FLAVOR");
  });

  it("never returns an amenities kind", () => {
    const vendorResult = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["Vendor A"],
    });
    const fallbackResult = buildDestinationMarqueeContent(baseInput);

    expect(vendorResult.kind).not.toBe("amenities");
    expect(fallbackResult.kind).not.toBe("amenities");
    expect(["vendors", "fallback"]).toContain(vendorResult.kind);
    expect(["vendors", "fallback"]).toContain(fallbackResult.kind);
  });
});
