import { describe, expect, it } from "vitest";

import { buildDestinationMarqueeItems } from "./pod-destination-marquee";

describe("buildDestinationMarqueeItems", () => {
  it("includes ordering facts and vendor count", () => {
    const items = buildDestinationMarqueeItems({
      orderingStatus: {
        tone: "open",
        label: "Open for orders",
        openVendorCount: 2,
        totalVendorCount: 2,
      },
      vendorCount: 3,
      amenities: [],
    });

    expect(items).toContain("OPEN FOR ORDERS");
    expect(items).toContain("3 FOOD CARTS");
    expect(items).toContain("ONE CHECKOUT");
    expect(items).toContain("GROUP ORDERING");
    expect(items).toContain("PICKUP UPDATES");
  });

  it("adds amenity labels when present", () => {
    const items = buildDestinationMarqueeItems({
      orderingStatus: {
        tone: "limited",
        label: "2 of 3 vendors open",
        openVendorCount: 2,
        totalVendorCount: 3,
      },
      vendorCount: 3,
      amenities: ["outdoor_seating", "bar", "games"],
    });

    expect(items).toContain("OUTDOOR SEATING");
    expect(items).toContain("BAR");
    expect(items).toContain("GAMES");
  });
});
