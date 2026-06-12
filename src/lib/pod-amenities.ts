export const POD_AMENITY_OPTIONS = [
  { id: "outdoor_seating", label: "Outdoor seating" },
  { id: "covered_seating", label: "Covered seating" },
  { id: "bar", label: "Bar" },
  { id: "family_friendly", label: "Family-friendly" },
  { id: "pet_friendly", label: "Pet-friendly" },
  { id: "parking", label: "Parking" },
  { id: "restrooms", label: "Restrooms" },
  { id: "events", label: "Events" },
  { id: "games", label: "Games" },
] as const;

export type PodAmenityId = (typeof POD_AMENITY_OPTIONS)[number]["id"];

const AMENITY_IDS = new Set<string>(POD_AMENITY_OPTIONS.map((o) => o.id));

const AMENITY_LABELS = Object.fromEntries(
  POD_AMENITY_OPTIONS.map((o) => [o.id, o.label])
) as Record<PodAmenityId, string>;

export function parsePodAmenities(value: unknown): PodAmenityId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<PodAmenityId>();
  const result: PodAmenityId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !AMENITY_IDS.has(item)) continue;
    const id = item as PodAmenityId;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function formatPodAmenitiesForDisplay(ids: PodAmenityId[]): { id: PodAmenityId; label: string }[] {
  return ids.map((id) => ({ id, label: AMENITY_LABELS[id] }));
}

export function normalizePodAmenitiesInput(ids: string[]): PodAmenityId[] {
  return parsePodAmenities(ids);
}
