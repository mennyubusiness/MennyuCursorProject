import type { PodAmenityId } from "@/lib/pod-amenities";
import type { PodOrderingStatus } from "@/lib/pod-page-status";

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

/**
 * Brooklyn Carreta–inspired feature strip — ordering facts first, then pod amenities.
 */
export function buildDestinationMarqueeItems(input: {
  orderingStatus: PodOrderingStatus;
  vendorCount: number;
  amenities: PodAmenityId[];
}): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  function push(label: string) {
    const key = label.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(label);
  }

  if (input.orderingStatus.tone === "open") {
    push("OPEN FOR ORDERS");
  } else if (input.orderingStatus.tone === "limited") {
    push(input.orderingStatus.label.toUpperCase());
  }

  if (input.vendorCount > 0) {
    push(
      `${input.vendorCount} FOOD CART${input.vendorCount === 1 ? "" : "S"}`
    );
  }

  push("ONE CHECKOUT");
  push("GROUP ORDERING");
  push("PICKUP UPDATES");

  for (const id of input.amenities) {
    const label = AMENITY_MARQUEE_LABELS[id];
    if (label) push(label);
  }

  return items;
}
