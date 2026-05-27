import { describe, expect, it } from "vitest";
import { isSpotlightMenuSection, partitionMenuSections } from "./vendor-menu-spotlight";

describe("vendor-menu-spotlight", () => {
  it("detects spotlight section names", () => {
    expect(isSpotlightMenuSection({ name: "Featured" })).toBe(true);
    expect(isSpotlightMenuSection({ name: "Most Ordered" })).toBe(true);
    expect(isSpotlightMenuSection({ name: "Entrees" })).toBe(false);
  });

  it("partitions sections without spotlight", () => {
    const sections = [
      { id: "a", name: "Mains", sortOrder: 0, items: [] },
      { id: "b", name: "Drinks", sortOrder: 1, items: [] },
    ];
    const { spotlightSections, mainSections } = partitionMenuSections(sections);
    expect(spotlightSections).toHaveLength(0);
    expect(mainSections).toHaveLength(2);
  });

  it("excludes spotlight sections from main list", () => {
    const sections = [
      { id: "f", name: "Featured", sortOrder: 0, items: [] },
      { id: "m", name: "Mains", sortOrder: 1, items: [] },
    ];
    const { spotlightSections, mainSections } = partitionMenuSections(sections);
    expect(spotlightSections.map((s) => s.id)).toEqual(["f"]);
    expect(mainSections.map((s) => s.id)).toEqual(["m"]);
  });
});
