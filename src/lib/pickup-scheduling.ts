/**
 * Scheduled pickup: wall-clock in an IANA timezone → UTC, validation, default slot suggestion.
 * Server-only (uses process.env for default timezone).
 */
import "server-only";

export const PICKUP_MIN_LEAD_MINUTES = 30;
export const PICKUP_MAX_DAYS_AHEAD = 14;

export function resolvePickupTimezone(pod: { pickupTimezone: string | null }): string {
  const fromPod = pod.pickupTimezone?.trim();
  if (fromPod) return fromPod;
  const fromEnv = process.env.DEFAULT_PICKUP_TIMEZONE?.trim();
  if (fromEnv) return fromEnv;
  return "America/New_York";
}

function readWallClockUTC(tMs: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(new Date(tMs));
  const g = (ty: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === ty)?.value ?? NaN);
  return {
    y: g("year"),
    mo: g("month"),
    d: g("day"),
    h: g("hour"),
    mi: g("minute"),
  };
}

/**
 * Interpret calendar date + clock time as a wall time in `timeZone` and return the corresponding UTC instant.
 */
export function wallTimeInZoneToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let t = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 48; i++) {
    const w = readWallClockUTC(t, timeZone);
    if (w.y === year && w.mo === month && w.d === day && w.h === hour && w.mi === minute) {
      return new Date(t);
    }
    const err =
      Date.UTC(year, month - 1, day, hour, minute, 0, 0) -
      Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, 0, 0);
    t += err;
  }
  throw new Error(`Invalid or unsupported pickup timezone: ${timeZone}`);
}

export function validateScheduledPickup(
  atUtc: Date,
  now: Date = new Date()
): { ok: true } | { ok: false; code: string; message: string } {
  const minMs = now.getTime() + PICKUP_MIN_LEAD_MINUTES * 60 * 1000;
  if (atUtc.getTime() < minMs) {
    return {
      ok: false,
      code: "PICKUP_TOO_SOON",
      message: `Pick a time at least ${PICKUP_MIN_LEAD_MINUTES} minutes from now.`,
    };
  }
  const maxMs = now.getTime() + PICKUP_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  if (atUtc.getTime() > maxMs) {
    return {
      ok: false,
      code: "PICKUP_TOO_FAR",
      message: `Pick a time within the next ${PICKUP_MAX_DAYS_AHEAD} days.`,
    };
  }
  return { ok: true };
}

/** Next wall time at least min lead from now, snapped to 15-minute boundaries in `timeZone`. */
export function getDefaultScheduledSuggestion(
  timeZone: string,
  now: Date = new Date()
): { date: string; time: string } {
  let t = now.getTime() + (PICKUP_MIN_LEAD_MINUTES + 5) * 60 * 1000;
  for (let j = 0; j < 96; j++) {
    const w = readWallClockUTC(t, timeZone);
    const totalMin = w.h * 60 + w.mi;
    const rem = totalMin % 15;
    if (rem !== 0) {
      t += (15 - rem) * 60 * 1000;
      continue;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${w.y}-${pad(w.mo)}-${pad(w.d)}`, time: `${pad(w.h)}:${pad(w.mi)}` };
  }
  const w = readWallClockUTC(t, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${w.y}-${pad(w.mo)}-${pad(w.d)}`, time: `${pad(w.h)}:${pad(w.mi)}` };
}
