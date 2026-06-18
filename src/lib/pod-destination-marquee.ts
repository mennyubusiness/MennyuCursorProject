import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";

const AMENITY_MARQUEE_LABELS: Partial<Record<PodAmenityId, string>> = {
  outdoor_seating: "OUTDOOR SEATING",
  covered_seating: "COVERED SEATING",
  bar: "BAR",
  family_friendly: "FAMILY FRIENDLY",
  pet_friendly: "PET FRIENDLY",
  parking: "PARKING",
  restrooms: "RESTROOMS",
  events: "EVENTS",
  games: "GAMES",
};

/** Platform capability copy — never used in the destination marquee. */
export const OPEN_ORDER_MARQUEE_BANNED = new Set([
  "ONE CHECKOUT",
  "GROUP ORDERING",
  "PICKUP UPDATES",
  "SCAN QR",
  "ORDER TOGETHER",
  "OPEN FOR ORDERS",
  "OPEN ORDER",
  "QR ORDERING",
  "MULTI-VENDOR CART",
]);

const GENERIC_VENUE_PHRASES = [
  "LOCAL FLAVOR",
  "EAT OUTSIDE",
  "GRAB A TABLE",
  "FOOD CARTS",
  "LOCAL FOOD CARTS",
  "EAT LOCAL",
  "GOOD TIMES",
  "FRESH AIR",
  "COMMUNITY GATHERING",
] as const;

const MIN_MARQUEE_ITEMS = 6;
const MAX_MARQUEE_ITEMS = 16;

export function cleanMarqueeLabel(raw: string): string | null {
  const stripped = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!stripped) return null;
  return stripped.toUpperCase().slice(0, 40);
}

/**
 * Pod identity strip — custom amenities, built-in amenities, vendors, then venue atmosphere.
 */
export function buildDestinationMarqueeItems(input: {
  podName: string;
  customAmenities: string[];
  amenities: PodAmenityId[];
  vendorNames: string[];
}): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  function push(label: string | null | undefined) {
    const cleaned = label ? cleanMarqueeLabel(label) : null;
    if (!cleaned || seen.has(cleaned) || OPEN_ORDER_MARQUEE_BANNED.has(cleaned)) return;
    seen.add(cleaned);
    items.push(cleaned);
  }

  for (const custom of input.customAmenities) {
    push(custom);
    if (items.length >= MAX_MARQUEE_ITEMS) return items;
  }

  for (const id of input.amenities) {
    const label = AMENITY_MARQUEE_LABELS[id] ?? formatPodAmenitiesForDisplay([id])[0]?.label;
    push(label);
    if (items.length >= MAX_MARQUEE_ITEMS) return items;
  }

  for (const name of input.vendorNames) {
    push(name);
    if (items.length >= MAX_MARQUEE_ITEMS) return items;
  }

  push(input.podName);

  for (const phrase of GENERIC_VENUE_PHRASES) {
    push(phrase);
    if (items.length >= MIN_MARQUEE_ITEMS) break;
  }

  return items.slice(0, MAX_MARQUEE_ITEMS);
}
