/**
 * Path helpers for validating login callback URLs (vendor/pod deep links).
 */

/** Extract vendor id from paths like /vendor/{id} or /vendor/{id}/orders. */
export function extractVendorIdFromVendorPath(path: string): string | null {
  const clean = path.split("?")[0] ?? path;
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] !== "vendor") return null;
  const id = parts[1] ?? null;
  if (!id || id === "dashboard" || id === "select") return null;
  return id;
}
