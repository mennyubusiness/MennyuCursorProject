import { describe, expect, it } from "vitest";

import type { PodCardPod } from "@/components/explore/PodCard";
import {
  filterMatchingPodsByName,
  filterExploreVendors,
  getAvailableCuisineChips,
  vendorMatchesCuisine,
} from "@/lib/explore-discovery";

const samplePods: PodCardPod[] = [
  {
    id: "p1",
    name: "Market Hall",
    description: "Downtown food hall",
    imageUrl: null,
    accentColor: null,
    address: "123 Main St",
    vendors: [
      {
        vendor: {
          id: "v1",
          name: "Seoul Bites",
          description: "Korean street food",
          cuisineCategory: "Korean",
          locationSummary: "Downtown",
          imageUrl: null,
        },
      },
      {
        vendor: {
          id: "v2",
          name: "Bean Theory",
          description: "Specialty coffee",
          cuisineCategory: "Coffee",
          locationSummary: null,
          imageUrl: null,
        },
      },
    ],
  },
  {
    id: "p2",
    name: "Riverside Pod",
    description: null,
    imageUrl: null,
    accentColor: null,
    address: null,
    vendors: [
      {
        vendor: {
          id: "v3",
          name: "Taco Libre",
          description: null,
          cuisineCategory: "Mexican",
          locationSummary: "Riverfront",
          imageUrl: null,
        },
      },
    ],
  },
];

describe("explore-discovery", () => {
  it("matches pods only by direct pod name query", () => {
    expect(filterMatchingPodsByName(samplePods, "market").map((p) => p.id)).toEqual(["p1"]);
    expect(filterMatchingPodsByName(samplePods, "riverside pod").map((p) => p.id)).toEqual(["p2"]);
  });

  it("does not match pods from vendor/cuisine/address terms", () => {
    expect(filterMatchingPodsByName(samplePods, "seoul")).toHaveLength(0);
    expect(filterMatchingPodsByName(samplePods, "korean")).toHaveLength(0);
    expect(filterMatchingPodsByName(samplePods, "downtown")).toHaveLength(0);
  });

  it("filters vendors by query and cuisine", () => {
    const hits = filterExploreVendors(samplePods, "coffee", "all");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.vendorName).toBe("Bean Theory");

    const mexican = filterExploreVendors(samplePods, "", "mexican");
    expect(mexican).toHaveLength(1);
    expect(mexican[0]?.vendorName).toBe("Taco Libre");
  });

  it("matches vendors by menu category name and stores matched section", () => {
    const withMenuCategories: PodCardPod[] = [
      {
        ...samplePods[0]!,
        vendors: [
          {
            vendor: {
              ...samplePods[0]!.vendors[0]!.vendor,
              menuCategoryNames: ["Steak & Burgers", "Drinks"],
            },
          },
        ],
      },
    ];

    const burgers = filterExploreVendors(withMenuCategories, "burger", "all");
    expect(burgers).toHaveLength(1);
    expect(burgers[0]?.matchedMenuCategory).toBe("Steak & Burgers");

    const drinks = filterExploreVendors(withMenuCategories, "drinks", "all");
    expect(drinks).toHaveLength(1);
    expect(drinks[0]?.matchedMenuCategory).toBe("Drinks");
  });

  it("returns cuisine chips backed by vendor data", () => {
    const chips = getAvailableCuisineChips(samplePods);
    expect(chips.some((c) => c.id === "all")).toBe(true);
    expect(chips.some((c) => c.id === "korean")).toBe(true);
    expect(chips.some((c) => c.id === "burgers")).toBe(false);
  });

  it("matches cuisine keywords case-insensitively", () => {
    expect(vendorMatchesCuisine("Korean BBQ", "korean")).toBe(true);
    expect(vendorMatchesCuisine("Burgers & Fries", "burgers")).toBe(true);
    expect(vendorMatchesCuisine("Italian", "korean")).toBe(false);
  });
});
