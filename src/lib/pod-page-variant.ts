/**
 * Controls which customer-facing pod page layout is shown.
 * No DB migration yet — slug allowlist + optional query/env overrides.
 */

/** Demo / pilot pods using the destination layout. */
const DESTINATION_POD_SLUGS = new Set(["downtown-food-pod"]);

function destinationPodIdsFromEnv(): Set<string> {
  const raw = process.env.DESTINATION_POD_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export type PodPageVariant = "standard" | "destination";

export function resolvePodPageVariant(input: {
  podId: string;
  podSlug: string;
  variantParam?: string | null;
}): PodPageVariant {
  const param = input.variantParam?.trim().toLowerCase();
  if (param === "destination") return "destination";
  if (param === "standard") return "standard";

  if (destinationPodIdsFromEnv().has(input.podId)) return "destination";
  if (DESTINATION_POD_SLUGS.has(input.podSlug)) return "destination";

  return "standard";
}

export function isDestinationPodPage(input: {
  podId: string;
  podSlug: string;
  variantParam?: string | null;
}): boolean {
  return resolvePodPageVariant(input) === "destination";
}
