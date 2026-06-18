import { describe, expect, it } from "vitest";

import {
  buildDestinationMarqueeItems,
  cleanMarqueeLabel,
  OPEN_ORDER_MARQUEE_BANNED,
} from "./pod-destination-marquee";

describe("cleanMarqueeLabel", () => {
  it("uppercases and trims labels", () => {
    expect(cleanMarqueeLabel("  live music  ")).toBe("LIVE MUSIC");
  });

  it("strips unsafe markup", () => {
    expect(cleanMarqueeLabel("<b>Bar</b>")).toBe("BAR");
  });
});

describe("buildDestinationMarqueeItems", () => {
  it("prioritizes custom amenities, then built-in amenities, then vendors", () => {
    const items = buildDestinationMarqueeItems({
      podName: "Downtown Food Pod",
      customAmenities: ["Live music", "Fire pits"],
      amenities: ["outdoor_seating", "bar"],
      vendorNames: ["Happy Burger", "River Coffee"],
    });

    expect(items.indexOf("LIVE MUSIC")).toBeLessThan(items.indexOf("OUTDOOR SEATING"));
    expect(items.indexOf("OUTDOOR SEATING")).toBeLessThan(items.indexOf("HAPPY BURGER"));
    expect(items).toContain("LIVE MUSIC");
    expect(items).toContain("FIRE PITS");
    expect(items).toContain("OUTDOOR SEATING");
    expect(items).toContain("HAPPY BURGER");
  });

  it("does not include Open Order capability copy", () => {
    const items = buildDestinationMarqueeItems({
      podName: "Test Pod",
      customAmenities: [],
      amenities: [],
      vendorNames: [],
    });

    for (const banned of OPEN_ORDER_MARQUEE_BANNED) {
      expect(items).not.toContain(banned);
    }
    expect(items).not.toContain("ONE CHECKOUT");
    expect(items).not.toContain("GROUP ORDERING");
    expect(items).not.toContain("PICKUP UPDATES");
  });

  it("deduplicates labels case-insensitively", () => {
    const items = buildDestinationMarqueeItems({
      podName: "Pod",
      customAmenities: ["Live Music", "live music"],
      amenities: ["bar"],
      vendorNames: ["Bar"],
    });

    expect(items.filter((item) => item === "LIVE MUSIC")).toHaveLength(1);
    expect(items.filter((item) => item === "BAR")).toHaveLength(1);
  });

  it("uses vendor names and generic venue phrases when amenities are sparse", () => {
    const items = buildDestinationMarqueeItems({
      podName: "Riverside Pod",
      customAmenities: [],
      amenities: [],
      vendorNames: ["Taco Cart"],
    });

    expect(items).toContain("TACO CART");
    expect(items).toContain("RIVERSIDE POD");
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.some((item) => item.includes("LOCAL") || item.includes("FOOD"))).toBe(true);
  });
});
