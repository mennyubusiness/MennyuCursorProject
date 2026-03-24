/** Two-letter monogram for vendor / item fallbacks when no image is shown. */
export function vendorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const p = parts[0] ?? "?";
  return p.length >= 2 ? p.slice(0, 2).toUpperCase() : `${p[0]!}${p[0]!}`.toUpperCase();
}
