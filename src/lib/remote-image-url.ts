/**
 * Whether a string is safe to pass to next/image as an external src in production.
 * Requires an absolute https URL (matches typical menu import validation).
 */
export function isHttpsImageUrl(value: string | null | undefined): value is string {
  if (value == null || typeof value !== "string") return false;
  const t = value.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
