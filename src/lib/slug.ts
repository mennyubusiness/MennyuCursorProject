/**
 * URL-safe slugs for Vendor.slug and Pod.slug.
 */

export function slugifyBase(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 60) || "venue";
}
