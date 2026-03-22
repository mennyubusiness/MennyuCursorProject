/**
 * Defensive parsing helpers for unknown Deliverect JSON.
 * Unknown fields stay on the raw object only — never copied into canonical.
 */

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

export function coerceInt(v: unknown, fallback: number): number {
  const n = asNumber(v);
  if (n === undefined) return fallback;
  return Math.trunc(n);
}

/** Prefer Deliverect-style _id, then id, then plu. */
export function firstDeliverectId(obj: Record<string, unknown>): string | undefined {
  return asString(obj._id) ?? asString(obj.id) ?? asString(obj.plu);
}
