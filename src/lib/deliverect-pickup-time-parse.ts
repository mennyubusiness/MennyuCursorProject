/**
 * Parse Deliverect `pickupTime` strings into a UTC {@link Date} instant.
 *
 * Deliverect documents preparation-time / order `pickupTime` as UTC (ISO 8601, often with `Z`).
 * If the provider omits the offset, ECMAScript would otherwise treat the value as **local wall time**
 * in the host environment, which shifts the stored instant between machines (e.g. dev vs Vercel).
 *
 * Rules:
 * - Strings that already end with `Z` or a numeric offset (`±HH:MM` / `±HHMM`) → `new Date(s)`.
 * - Naive `YYYY-MM-DDTHH:mm:ss` (optional fractional seconds) → parse as **UTC** by appending `Z`.
 */
export function parseDeliverectInboundPickupUtc(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  if (hasExplicitUtcOrOffset(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(`${s}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasExplicitUtcOrOffset(s: string): boolean {
  if (/Z$/i.test(s)) return true;
  // ±HH:MM or ±HHMM at end (optional :ss for offset with seconds — rare)
  return /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
}
