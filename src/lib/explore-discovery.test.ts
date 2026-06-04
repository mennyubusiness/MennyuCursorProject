import { describe, expect, it } from "vitest";

import type { PodCardPod } from "@/components/explore/PodCard";
import {
  filterMatchingPodsByName,
  filterExploreVendors,
  formatPodVendorCountLine,
  getAvailableCuisineChips,
  getExplorePodsToDisplay,
  getExploreVendorSectionTitle,
  getPodCuisinePreview,
  getPodVendorCounts,
  hasActiveExploreFilters,
  shouldHidePodSectionForSearchOnly,
  vendorMatchesCuisine,
} from "./explore-discovery";

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
          isActive: true,
          mennyuOrdersPaused: false,
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
          isActive: true,
          mennyuOrdersPaused: false,
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
          isActive: true,
          mennyuOrdersPaused: true,
        },
      },
    ],
  },
];

describe("explore-discovery", () => {
  it("shows all pods by default with no query", () => {
    const displayed = getExplorePodsToDisplay(samplePods, "", "all", null);
    expect(displayed.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("matches pods only by direct pod name query", () => {
    expect(filterMatchingPodsByName(samplePods, "market").map((p) => p.id)).toEqual(["p1"]);
    expect(filterMatchingPodsByName(samplePods, "riverside pod").map((p) => p.id)).toEqual(["p2"]);
  });

  it("does not match pods from vendor/cuisine/address terms", () => {
    expect(filterMatchingPodsByName(samplePods, "seoul")).toHaveLength(0);
    expect(filterMatchingPodsByName(samplePods, "korean")).toHaveLength(0);
    expect(filterMatchingPodsByName(samplePods, "downtown")).toHaveLength(0);
  });

  it("pod cards expose name and vendor counts", () => {
    const counts = getPodVendorCounts(samplePods[0]!);
    expect(counts.total).toBe(2);
    expect(counts.open).toBe(2);
    expect(formatPodVendorCountLine(counts)).toBe("2 of 2 vendors open");
    expect(getPodCuisinePreview(samplePods[0]!)).toEqual(expect.arrayContaining(["Korean", "Coffee"]));
  });

  it("filters vendors to selected pod", () => {
    const hits = filterExploreVendors(samplePods, "", "all", "p2");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.vendorName).toBe("Taco Libre");
    expect(hits[0]?.podId).toBe("p2");
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

  it("vendor section title reflects pod selection", () => {
    expect(
      getExploreVendorSectionTitle({
        query: "",
        cuisineId: "all",
        selectedPodId: "p1",
        selectedPodName: "Market Hall",
      }).title
    ).toBe("Vendors at Market Hall");
  });

  it("vendor section title reflects search", () => {
    expect(
      getExploreVendorSectionTitle({
        query: "coffee",
        cuisineId: "all",
        selectedPodId: null,
        selectedPodName: null,
      }).title
    ).toBe("Matching vendors");
  });

  it("vendor section title reflects cuisine filter", () => {
    expect(
      getExploreVendorSectionTitle({
        query: "",
        cuisineId: "mexican",
        selectedPodId: null,
        selectedPodName: null,
      }).title
    ).toBe("Mexican vendors");
  });

  it("hasActiveExploreFilters includes pod selection", () => {
    expect(hasActiveExploreFilters("", "all", "p1")).toBe(true);
    expect(hasActiveExploreFilters("", "all", null)).toBe(false);
  });

  it("can hide pod section for vendor-only search with no pod name match", () => {
    expect(shouldHidePodSectionForSearchOnly(samplePods, "seoul", "all")).toBe(true);
    expect(shouldHidePodSectionForSearchOnly(samplePods, "market", "all")).toBe(false);
  });

  it("prioritizes name-matching pods when filtering", () => {
    const displayed = getExplorePodsToDisplay(samplePods, "market", "all", null);
    expect(displayed[0]?.id).toBe("p1");
  });
});
