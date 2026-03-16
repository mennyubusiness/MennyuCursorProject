/**
 * Normalize Date-vs-string runtime values for safe date math.
 * Use after query narrowing or serialization where values may be ISO strings.
 */

export type DateLike = Date | string | number | null | undefined;

/**
 * Convert a date-like value to milliseconds since epoch.
 * Accepts Date, ISO string, or number (ms). Returns NaN for null/undefined/invalid.
 */
export function toTimeMs(value: DateLike): number {
  if (value == null) return NaN;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as string);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : NaN;
}

/**
 * True if the given date is older than `minutes` before `nowMs` (default: Date.now()).
 */
export function isOlderThanMinutes(
  value: DateLike,
  minutes: number,
  nowMs?: number
): boolean {
  const t = toTimeMs(value);
  if (!Number.isFinite(t)) return false;
  const now = nowMs ?? Date.now();
  return now - t > minutes * 60 * 1000;
}

/**
 * Age in whole minutes from `value` to `nowMs` (default: Date.now()).
 * Returns 0 for invalid/unknown values.
 */
export function ageMinutes(value: DateLike, nowMs?: number): number {
  const t = toTimeMs(value);
  if (!Number.isFinite(t)) return 0;
  const now = nowMs ?? Date.now();
  return Math.floor((now - t) / (60 * 1000));
}
