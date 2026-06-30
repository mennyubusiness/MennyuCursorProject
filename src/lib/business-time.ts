/**
 * Canonical business-time utilities for Open Order.
 *
 * All vendor/pod open-hours logic must use this module — not server local time,
 * browser local time, fixed UTC offsets, or Date#getHours().
 *
 * Recurring hours are wall-clock times in an IANA timezone (DST-aware).
 */

/** Default when Pod.pickupTimezone is unset — Portland / Oregon pods. */
export const DEFAULT_BUSINESS_TIMEZONE = "America/Los_Angeles";

export type BusinessWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const BUSINESS_WEEKDAYS: readonly BusinessWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type BusinessHoursDayRow = {
  day: BusinessWeekday;
  isOpen: boolean;
  /** Local wall-clock HH:MM (24h). */
  openTime: string;
  closeTime: string;
};

export type BusinessHoursCloseRule =
  | "exclusive_at_close"
  | "inclusive_through_close";

/** At close wall time the vendor is closed (industry default). */
export const BUSINESS_HOURS_CLOSE_RULE: BusinessHoursCloseRule = "exclusive_at_close";

export type BusinessHoursReasonCode =
  | "open_within_hours"
  | "open_until_close"
  | "closed_before_open"
  | "closed_after_close"
  | "closed_today"
  | "missing_hours"
  | "invalid_day_row"
  | "invalid_timezone";

export type BusinessLocalClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: BusinessWeekday;
  minutesSinceMidnight: number;
};

export type BusinessHoursEvaluation = {
  timeZone: string;
  serverUtcIso: string;
  businessLocalLabel: string;
  clock: BusinessLocalClock;
  matchedDay: BusinessHoursDayRow | null;
  isOpen: boolean;
  reasonCode: BusinessHoursReasonCode;
  reasonDetail: string;
  openMinutes: number | null;
  closeMinutes: number | null;
  closeRule: BusinessHoursCloseRule;
};

function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the IANA timezone for business-hours and pickup display.
 * Pod timezone wins; optional env override; then Pacific default for Oregon pods.
 */
export function resolveBusinessTimezone(input?: {
  podPickupTimezone?: string | null;
  vendorTimezone?: string | null;
  envDefaultTimezone?: string | null;
}): string {
  const fromVendor = input?.vendorTimezone?.trim();
  if (fromVendor && isValidIanaTimeZone(fromVendor)) return fromVendor;

  const fromPod = input?.podPickupTimezone?.trim();
  if (fromPod && isValidIanaTimeZone(fromPod)) return fromPod;

  const fromEnv = input?.envDefaultTimezone?.trim();
  if (fromEnv && isValidIanaTimeZone(fromEnv)) return fromEnv;

  return DEFAULT_BUSINESS_TIMEZONE;
}

/** @deprecated Prefer resolveBusinessTimezone — kept for existing imports. */
export function resolveVendorHoursTimezone(podTimezone: string | null | undefined): string {
  return resolveBusinessTimezone({
    podPickupTimezone: podTimezone,
    envDefaultTimezone: process.env.DEFAULT_PICKUP_TIMEZONE,
  });
}

export function businessTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  return h * 60 + m;
}

/**
 * Read wall-clock components in `timeZone` from a UTC instant.
 * Uses en-CA + hourCycle h23 to avoid midnight "24" and DST offset bugs.
 */
export function getBusinessLocalClock(now: Date, timeZone: string): BusinessLocalClock {
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_BUSINESS_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(now);

  const read = (ty: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === ty)?.value ?? NaN);

  const hour = read("hour");
  const minute = read("minute");
  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "monday";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute,
    weekday: weekdayRaw as BusinessWeekday,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function getWeekdayInTimezone(now: Date, timeZone: string): BusinessWeekday {
  return getBusinessLocalClock(now, timeZone).weekday;
}

export function getMinutesInTimezone(now: Date, timeZone: string): number {
  return getBusinessLocalClock(now, timeZone).minutesSinceMidnight;
}

export function formatBusinessLocalLabel(now: Date, timeZone: string): string {
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_BUSINESS_TIMEZONE;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
}

/**
 * Whether `minutes` falls inside today's open window.
 * Supports overnight windows (close < open) when stored that way.
 */
export function isOpenAtMinutes(
  row: BusinessHoursDayRow,
  minutes: number,
  closeRule: BusinessHoursCloseRule = BUSINESS_HOURS_CLOSE_RULE
): boolean {
  if (!row.isOpen) return false;

  const openMin = businessTimeToMinutes(row.openTime);
  const closeMin = businessTimeToMinutes(row.closeTime);

  if (openMin === closeMin) return false;

  if (closeMin > openMin) {
    if (closeRule === "exclusive_at_close") {
      return minutes >= openMin && minutes < closeMin;
    }
    return minutes >= openMin && minutes <= closeMin;
  }

  // Overnight: e.g. 17:00 – 01:00
  if (closeRule === "exclusive_at_close") {
    return minutes >= openMin || minutes < closeMin;
  }
  return minutes >= openMin || minutes <= closeMin;
}

export function isOpenAtTime(
  week: BusinessHoursDayRow[],
  weekday: BusinessWeekday,
  minutes: number,
  closeRule: BusinessHoursCloseRule = BUSINESS_HOURS_CLOSE_RULE
): boolean {
  const row = week.find((d) => d.day === weekday);
  if (!row) return false;
  return isOpenAtMinutes(row, minutes, closeRule);
}

export function evaluateBusinessHours(input: {
  week: BusinessHoursDayRow[] | null;
  timeZone: string;
  now?: Date;
  closeRule?: BusinessHoursCloseRule;
}): BusinessHoursEvaluation {
  const now = input.now ?? new Date();
  const closeRule = input.closeRule ?? BUSINESS_HOURS_CLOSE_RULE;
  const resolvedZone = resolveBusinessTimezone({ podPickupTimezone: input.timeZone });
  const clock = getBusinessLocalClock(now, resolvedZone);
  const base = {
    timeZone: resolvedZone,
    serverUtcIso: now.toISOString(),
    businessLocalLabel: formatBusinessLocalLabel(now, resolvedZone),
    clock,
    closeRule,
  };

  if (!input.week || input.week.length === 0) {
    return {
      ...base,
      matchedDay: null,
      isOpen: false,
      reasonCode: "missing_hours",
      reasonDetail: "No customer ordering hours configured.",
      openMinutes: null,
      closeMinutes: null,
    };
  }

  const matchedDay = input.week.find((d) => d.day === clock.weekday) ?? null;

  if (!matchedDay) {
    return {
      ...base,
      matchedDay: null,
      isOpen: false,
      reasonCode: "invalid_day_row",
      reasonDetail: `No hours row for ${clock.weekday}.`,
      openMinutes: null,
      closeMinutes: null,
    };
  }

  if (!matchedDay.isOpen) {
    return {
      ...base,
      matchedDay,
      isOpen: false,
      reasonCode: "closed_today",
      reasonDetail: "Closed today.",
      openMinutes: null,
      closeMinutes: null,
    };
  }

  const openMinutes = businessTimeToMinutes(matchedDay.openTime);
  const closeMinutes = businessTimeToMinutes(matchedDay.closeTime);
  const isOpen = isOpenAtMinutes(matchedDay, clock.minutesSinceMidnight, closeRule);

  if (isOpen) {
    const reasonCode: BusinessHoursReasonCode =
      clock.minutesSinceMidnight < closeMinutes || closeMinutes <= openMinutes
        ? "open_within_hours"
        : "open_until_close";
    return {
      ...base,
      matchedDay,
      isOpen: true,
      reasonCode,
      reasonDetail:
        closeRule === "exclusive_at_close"
          ? `Open until ${matchedDay.closeTime} (${resolvedZone}); closes at that wall time.`
          : `Open through ${matchedDay.closeTime} (${resolvedZone}).`,
      openMinutes,
      closeMinutes,
    };
  }

  if (clock.minutesSinceMidnight < openMinutes) {
    return {
      ...base,
      matchedDay,
      isOpen: false,
      reasonCode: "closed_before_open",
      reasonDetail: `Closed until ${matchedDay.openTime} (${resolvedZone}).`,
      openMinutes,
      closeMinutes,
    };
  }

  return {
    ...base,
    matchedDay,
    isOpen: false,
    reasonCode: "closed_after_close",
    reasonDetail: `Closed after ${matchedDay.closeTime} (${resolvedZone}).`,
    openMinutes,
    closeMinutes,
  };
}

export function isWithinBusinessHours(input: {
  week: BusinessHoursDayRow[] | null;
  timeZone: string;
  now?: Date;
}): boolean {
  return evaluateBusinessHours(input).isOpen;
}
