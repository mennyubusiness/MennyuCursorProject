import { describe, expect, it } from "vitest";
import { buildPodPageNavItems } from "./pod-page-nav";

describe("buildPodPageNavItems", () => {
  it("always includes Vendors first", () => {
    const items = buildPodPageNavItems({
      hasAboutSection: false,
      hasLocationSection: false,
      hasContactSection: false,
    });
    expect(items.map((i) => i.label)).toEqual(["Vendors"]);
  });

  it("orders nav items for a complete pod page", () => {
    const items = buildPodPageNavItems({
      hasAboutSection: true,
      hasLocationSection: true,
      hasContactSection: true,
    });
    expect(items.map((i) => i.label)).toEqual(["Vendors", "About", "Location", "Contact"]);
  });

  it("omits empty sections from tabs", () => {
    const items = buildPodPageNavItems({
      hasAboutSection: false,
      hasLocationSection: false,
      hasContactSection: true,
    });
    expect(items.map((i) => i.label)).toEqual(["Vendors", "Contact"]);
  });
});
