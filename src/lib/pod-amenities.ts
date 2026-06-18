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

export const MAX_POD_CUSTOM_AMENITIES = 12;
export const MAX_POD_CUSTOM_AMENITY_LENGTH = 40;

function stripUnsafeText(raw: string): string {
  return raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function parsePodCustomAmenities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const cleaned = stripUnsafeText(item).slice(0, MAX_POD_CUSTOM_AMENITY_LENGTH);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= MAX_POD_CUSTOM_AMENITIES) break;
  }
  return result;
}

/** Accepts comma/newline-separated text or string array from forms. */
export function normalizePodCustomAmenitiesInput(raw: string | string[] | undefined | null): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : (raw ?? "")
        .split(/[,;\n]+/)
        .map((part) => part.trim())
        .filter(Boolean);
  return parsePodCustomAmenities(parts);
}

export function formatCustomAmenitiesForDisplay(labels: string[]): { id: string; label: string }[] {
  return labels.map((label, index) => ({
    id: `custom-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label,
  }));
}
