import { describe, expect, it } from "vitest";

import {
  buildDestinationMarqueeContent,
  cleanMarqueeLabel,
  DESTINATION_MARQUEE_MIN_ROW_ITEMS,
  expandMarqueeLoopItems,
  getMarqueeRepeatCycles,
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

describe("getMarqueeRepeatCycles", () => {
  it("uses more cycles for fewer unique vendors", () => {
    expect(getMarqueeRepeatCycles(1)).toBe(12);
    expect(getMarqueeRepeatCycles(3)).toBe(10);
    expect(getMarqueeRepeatCycles(6)).toBe(6);
    expect(getMarqueeRepeatCycles(8)).toBe(4);
  });
});

describe("expandMarqueeLoopItems", () => {
  it("repeats a single vendor many times", () => {
    const expanded = expandMarqueeLoopItems(["TACO FIESTA"]);

    expect(expanded.length).toBeGreaterThanOrEqual(DESTINATION_MARQUEE_MIN_ROW_ITEMS);
    expect(expanded.every((item) => item === "TACO FIESTA")).toBe(true);
  });

  it("repeats three vendors in cycles", () => {
    const expanded = expandMarqueeLoopItems(["TACO FIESTA", "EASTSIDE NOODLES", "GREEN BOWL"]);

    expect(expanded.length).toBeGreaterThanOrEqual(DESTINATION_MARQUEE_MIN_ROW_ITEMS);
    expect(expanded.slice(0, 3)).toEqual(["TACO FIESTA", "EASTSIDE NOODLES", "GREEN BOWL"]);
    expect(expanded[3]).toBe("TACO FIESTA");
  });
});

describe("buildDestinationMarqueeContent", () => {
  it("returns expanded vendor names when vendors exist", () => {
    const result = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["Happy Burger", "River Coffee", "Taco Stand"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items.length).toBeGreaterThanOrEqual(DESTINATION_MARQUEE_MIN_ROW_ITEMS);
    expect(result.items.slice(0, 3)).toEqual(["HAPPY BURGER", "RIVER COFFEE", "TACO STAND"]);
  });

  it("does not use amenities in marquee output", () => {
    const result = buildDestinationMarqueeContent({
      podName: "Downtown Food Pod",
      vendorNames: ["Happy Burger"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items.every((item) => item === "HAPPY BURGER")).toBe(true);
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

  it("deduplicates vendor names case-insensitively before repeating", () => {
    const result = buildDestinationMarqueeContent({
      ...baseInput,
      vendorNames: ["Happy Burger", "happy burger", "River Coffee"],
    });

    expect(result.kind).toBe("vendors");
    expect(result.items.every((item) => item === "HAPPY BURGER" || item === "RIVER COFFEE")).toBe(true);
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
