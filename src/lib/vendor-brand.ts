import { isHttpsImageUrl } from "@/lib/remote-image-url";

/** Strict #RRGGBB only — safe for inline CSS color values. */
const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function parseSafeHexAccentColor(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!HEX6.test(t)) return null;
  return t.toLowerCase();
}

/** Returns null when empty; rejects non-HTTPS URLs (matches VendorLogo / next/image rules). */
export function normalizeVendorLogoUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!isHttpsImageUrl(t)) return null;
  return t;
}

const NAME_MAX = 200;
const DESC_MAX = 2000;

export function normalizeVendorDisplayName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: false, error: "Business name is required." };
  if (t.length > NAME_MAX) return { ok: false, error: `Business name must be at most ${NAME_MAX} characters.` };
  return { ok: true, value: t };
}

export function normalizeVendorDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length > DESC_MAX ? t.slice(0, DESC_MAX) : t;
}
