import type { PodCardPod } from "@/components/explore/PodCard";
import {
  getVendorAvailabilityStatus,
  type VendorAvailabilityStatus,
} from "@/lib/vendor-availability";

export type ExploreVendorHit = {
  vendorId: string;
  vendorName: string;
  description: string | null;
  cuisineCategory: string | null;
  locationSummary: string | null;
  imageUrl: string | null;
  podId: string;
  podName: string;
  menuCategoryNames: string[];
  matchedMenuCategory: string | null;
  availabilityStatus: VendorAvailabilityStatus;
};

export type ExploreCuisineChip = {
  id: string;
  label: string;
  keywords: string[];
};

/** Curated cuisine chips mapped to free-text vendor `cuisineCategory` values. */
export const EXPLORE_CUISINE_CHIPS: ExploreCuisineChip[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "burgers", label: "Burgers", keywords: ["burger", "burgers"] },
  { id: "korean", label: "Korean", keywords: ["korean", "korea"] },
  { id: "mexican", label: "Mexican", keywords: ["mexican", "mexico", "taco", "tacos"] },
  { id: "coffee", label: "Coffee", keywords: ["coffee", "cafe", "café", "espresso"] },
  { id: "dessert", label: "Dessert", keywords: ["dessert", "bakery", "baker", "sweet", "pastry"] },
  { id: "breakfast", label: "Breakfast", keywords: ["breakfast", "brunch"] },
  { id: "drinks", label: "Drinks", keywords: ["drink", "drinks", "beverage", "juice", "smoothie", "tea"] },
  { id: "vegan", label: "Vegan", keywords: ["vegan", "plant-based", "plant based"] },
];

export function normalizeExploreQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function singularizeWord(word: string): string {
  if (word.length <= 2) return word;
  if (word.endsWith("ies") && word.length > 3) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 2) return word.slice(0, -1);
  return word;
}

function buildQueryTokens(q: string): string[] {
  const words = q.split(" ").filter((word) => word.length > 0);
  const expanded = new Set<string>([q]);
  for (const word of words) {
    expanded.add(word);
    expanded.add(singularizeWord(word));
  }
  return [...expanded].filter((token) => token.length > 0);
}

function matchQueryAgainstText(q: string, text: string | null | undefined): boolean {
  if (!q) return true;
  if (!text) return false;
  const normalized = normalizeExploreQuery(text);
  if (!normalized) return false;
  if (normalized.includes(q)) return true;
  const tokens = buildQueryTokens(q);
  return tokens.some((token) => normalized.includes(token));
}

function findMatchingMenuCategory(menuCategoryNames: string[], q: string): string | null {
  if (!q || menuCategoryNames.length === 0) return null;
  for (const name of menuCategoryNames) {
    if (matchQueryAgainstText(q, name)) return name;
  }
  return null;
}

export function vendorMatchesCuisine(
  cuisineCategory: string | null | undefined,
  cuisineId: string
): boolean {
  if (cuisineId === "all") return true;
  const chip = EXPLORE_CUISINE_CHIPS.find((c) => c.id === cuisineId);
  if (!chip || chip.keywords.length === 0) return true;
  const cat = (cuisineCategory ?? "").toLowerCase();
  if (!cat) return false;
  return chip.keywords.some((kw) => cat.includes(kw));
}

export function flattenExploreVendors(pods: PodCardPod[]): ExploreVendorHit[] {
  const rows: ExploreVendorHit[] = [];
  for (const pod of pods) {
    for (const pv of pod.vendors) {
      const v = pv.vendor;
      rows.push({
        vendorId: v.id,
        vendorName: v.name,
        description: v.description,
        cuisineCategory: v.cuisineCategory ?? null,
        locationSummary: v.locationSummary ?? null,
        imageUrl: v.imageUrl ?? null,
        podId: pod.id,
        podName: pod.name,
        menuCategoryNames: v.menuCategoryNames ?? [],
        matchedMenuCategory: null,
        availabilityStatus: getVendorAvailabilityStatus({
          isActive: v.isActive,
          mennyuOrdersPaused: v.mennyuOrdersPaused,
        }),
      });
    }
  }
  rows.sort(
    (a, b) =>
      a.vendorName.localeCompare(b.vendorName) || a.podName.localeCompare(b.podName)
  );
  return rows;
}

export function vendorHitMatchesQuery(hit: ExploreVendorHit, q: string): boolean {
  if (!q) return true;
  return (
    matchQueryAgainstText(q, hit.vendorName) ||
    matchQueryAgainstText(q, hit.description) ||
    matchQueryAgainstText(q, hit.cuisineCategory) ||
    matchQueryAgainstText(q, hit.locationSummary) ||
    matchQueryAgainstText(q, hit.podName) ||
    findMatchingMenuCategory(hit.menuCategoryNames, q) != null
  );
}

export function vendorHitMatchesCuisine(hit: ExploreVendorHit, cuisineId: string): boolean {
  return vendorMatchesCuisine(hit.cuisineCategory, cuisineId);
}

/** Direct pod-name matching only; never uses vendor/cuisine fields. */
export function filterMatchingPodsByName(pods: PodCardPod[], query: string): PodCardPod[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];
  return pods
    .filter((pod) => {
      const podName = normalizeExploreQuery(pod.name);
      return podName.includes(q) || q.includes(podName);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterExploreVendors(
  pods: PodCardPod[],
  query: string,
  cuisineId: string
): ExploreVendorHit[] {
  const q = normalizeExploreQuery(query);
  return flattenExploreVendors(pods)
    .map((hit) => ({
      ...hit,
      matchedMenuCategory: findMatchingMenuCategory(hit.menuCategoryNames, q),
    }))
    .filter((hit) => vendorHitMatchesQuery(hit, q) && vendorHitMatchesCuisine(hit, cuisineId));
}

/** Cuisine chips that have at least one vendor match (always includes All). */
export function getAvailableCuisineChips(pods: PodCardPod[]): ExploreCuisineChip[] {
  const vendors = flattenExploreVendors(pods);
  return EXPLORE_CUISINE_CHIPS.filter(
    (chip) =>
      chip.id === "all" ||
      vendors.some((v) => vendorMatchesCuisine(v.cuisineCategory, chip.id))
  );
}

export function hasActiveExploreFilters(query: string, cuisineId: string): boolean {
  return normalizeExploreQuery(query).length > 0 || cuisineId !== "all";
}
