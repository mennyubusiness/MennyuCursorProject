/**
 * Vendor customer-facing ordering hours — manual Open Order weekly schedule.
 * Deliverect sync is retained in the schema/backend but disabled in vendor-facing product flows.
 *
 * Wall-clock evaluation delegates to {@link ./business-time.ts}.
 */

import {
  BUSINESS_WEEKDAYS,
  businessTimeToMinutes,
  evaluateBusinessHours,
  formatBusinessLocalLabel,
  getBusinessLocalClock,
  getMinutesInTimezone,
  getWeekdayInTimezone,
  isOpenAtTime as isOpenAtBusinessTime,
  isWithinBusinessHours,
  resolveBusinessTimezone,
  resolveVendorHoursTimezone,
} from "@/lib/business-time";

export {
  evaluateBusinessHours,
  formatBusinessLocalLabel,
  getBusinessLocalClock,
  resolveBusinessTimezone,
  resolveVendorHoursTimezone,
};
export type { BusinessHoursEvaluation } from "@/lib/business-time";

export const VENDOR_WEEKDAYS = BUSINESS_WEEKDAYS;

export type VendorWeekday = (typeof VENDOR_WEEKDAYS)[number];

export const VENDOR_WEEKDAY_LABELS: Record<VendorWeekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export type VendorCustomerOrderingDayHours = {
  day: VendorWeekday;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type VendorCustomerOrderingWeek = VendorCustomerOrderingDayHours[];

export type VendorHoursSourceFields = {
  syncCustomerOrderingHoursFromDeliverect: boolean;
  customerOrderingHours: unknown;
  deliverectSyncedCustomerOrderingHours: unknown;
  deliverectSyncedCustomerOrderingHoursSyncStatus?: string | null;
};

export type VendorHoursSyncStatus = "ok" | "failed" | null;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function defaultVendorCustomerOrderingWeek(): VendorCustomerOrderingWeek {
  return VENDOR_WEEKDAYS.map((day) => ({
    day,
    isOpen: day !== "sunday",
    openTime: "09:00",
    closeTime: "21:00",
  }));
}

function isWeekday(value: string): value is VendorWeekday {
  return (VENDOR_WEEKDAYS as readonly string[]).includes(value);
}

export function parseVendorCustomerOrderingWeek(raw: unknown): VendorCustomerOrderingWeek | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const byDay = new Map<VendorWeekday, VendorCustomerOrderingDayHours>();

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const dayRaw = typeof obj.day === "string" ? obj.day.toLowerCase() : "";
    if (!isWeekday(dayRaw)) continue;
    const isOpen = obj.isOpen === true;
    const openTime = typeof obj.openTime === "string" ? obj.openTime : "09:00";
    const closeTime = typeof obj.closeTime === "string" ? obj.closeTime : "17:00";
    byDay.set(dayRaw, { day: dayRaw, isOpen, openTime, closeTime });
  }

  if (byDay.size === 0) return null;

  return VENDOR_WEEKDAYS.map((day) => byDay.get(day) ?? { day, isOpen: false, openTime: "09:00", closeTime: "17:00" });
}

export function validateVendorCustomerOrderingWeek(week: VendorCustomerOrderingWeek): string | null {
  let openDayCount = 0;

  for (const row of week) {
    if (!isWeekday(row.day)) return "Each day must be a valid weekday.";
    if (!row.isOpen) continue;
    openDayCount += 1;
    if (!TIME_RE.test(row.openTime) || !TIME_RE.test(row.closeTime)) {
      return "Open and close times must use HH:MM format.";
    }
    const openMin = businessTimeToMinutes(row.openTime);
    const closeMin = businessTimeToMinutes(row.closeTime);
    if (closeMin <= openMin) {
      return `${VENDOR_WEEKDAY_LABELS[row.day]}: closing time must be after opening time.`;
    }
  }

  if (openDayCount === 0) {
    return "At least one day must be open for customer ordering.";
  }

  return null;
}

/** True when saved JSON parses to a valid manual customer ordering week. */
export function hasValidVendorCustomerOrderingHours(raw: unknown): boolean {
  const week = parseVendorCustomerOrderingWeek(raw);
  if (!week) return false;
  return validateVendorCustomerOrderingWeek(week) === null;
}

function parseActiveVendorCustomerOrderingWeek(raw: unknown): VendorCustomerOrderingWeek | null {
  const week = parseVendorCustomerOrderingWeek(raw);
  if (!week || validateVendorCustomerOrderingWeek(week) !== null) return null;
  return week;
}

function formatMinutes12h(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatDayHoursLabel(row: VendorCustomerOrderingDayHours): string {
  if (!row.isOpen) return "Closed";
  return `${formatMinutes12h(businessTimeToMinutes(row.openTime))} – ${formatMinutes12h(businessTimeToMinutes(row.closeTime))}`;
}

export { getWeekdayInTimezone, getMinutesInTimezone };

export function isOpenAtTime(
  week: VendorCustomerOrderingWeek,
  weekday: VendorWeekday,
  minutes: number
): boolean {
  return isOpenAtBusinessTime(week, weekday, minutes);
}

/**
 * Returns whether the vendor is within manual customer ordering hours.
 * false = no valid manual hours configured, or currently outside configured hours.
 */
export function isVendorWithinCustomerOrderingHours(input: {
  customHours: VendorCustomerOrderingWeek | null;
  timeZone: string;
  now?: Date;
  /** @deprecated Deliverect sync is disabled in vendor-facing flows; ignored when omitted. */
  syncFromDeliverect?: boolean;
  syncedHours?: VendorCustomerOrderingWeek | null;
}): boolean {
  if (!input.customHours) return false;
  const timeZone = resolveVendorHoursTimezone(input.timeZone);
  return isWithinBusinessHours({
    week: input.customHours,
    timeZone,
    now: input.now,
  });
}

export function resolveVendorPosOpen(
  vendor: VendorHoursSourceFields,
  timeZone: string,
  now?: Date
): boolean {
  const customHours = parseActiveVendorCustomerOrderingWeek(vendor.customerOrderingHours);
  const resolvedZone = resolveVendorHoursTimezone(timeZone);
  return isWithinBusinessHours({
    week: customHours,
    timeZone: resolvedZone,
    now,
  });
}

/** Merge vendor flags with computed customer-ordering-hours open state for orderability checks. */
export function vendorAvailabilityWithCustomerOrderingHours(
  vendor: VendorHoursSourceFields & {
    isActive?: boolean;
    mennyuOrdersPaused?: boolean;
    deliverectChannelLinkId?: string | null;
  },
  podTimezone: string | null | undefined,
  now?: Date
) {
  const timeZone = resolveVendorHoursTimezone(podTimezone);
  return {
    isActive: vendor.isActive,
    mennyuOrdersPaused: vendor.mennyuOrdersPaused,
    deliverectChannelLinkId: vendor.deliverectChannelLinkId,
    posOpen: resolveVendorPosOpen(vendor, timeZone, now),
  };
}

export type VendorHoursStatusSummary = {
  sourceLabel: string;
  todayLabel: string;
  nextOpeningLabel: string | null;
  posOpen: boolean | undefined;
  needsHoursAttention: boolean;
  syncFailed: boolean;
};

export function summarizeVendorCustomerOrderingHours(input: {
  vendor: Pick<VendorHoursSourceFields, "customerOrderingHours">;
  timeZone: string;
  now?: Date;
}): VendorHoursStatusSummary {
  const now = input.now ?? new Date();
  const timeZone = resolveVendorHoursTimezone(input.timeZone);
  const customHours = parseActiveVendorCustomerOrderingWeek(input.vendor.customerOrderingHours);

  if (!customHours) {
    return {
      sourceLabel: "Hours need setup",
      todayLabel: "Hours need setup",
      nextOpeningLabel: null,
      posOpen: false,
      needsHoursAttention: true,
      syncFailed: false,
    };
  }

  const evaluation = evaluateBusinessHours({ week: customHours, timeZone, now });
  const weekday = evaluation.clock.weekday;
  const todayRow = customHours.find((d) => d.day === weekday);
  const minutes = evaluation.clock.minutesSinceMidnight;
  const openNow = isOpenAtTime(customHours, weekday, minutes);

  let todayLabel = "Closed today";
  if (todayRow?.isOpen) {
    todayLabel = openNow
      ? `Open until ${formatMinutes12h(businessTimeToMinutes(todayRow.closeTime))}`
      : `Closed · hours ${formatDayHoursLabel(todayRow)}`;
  } else if (todayRow) {
    todayLabel = "Closed today";
  }

  const nextOpeningLabel = findNextOpeningLabel(customHours, timeZone, now);

  return {
    sourceLabel: "Customer ordering hours",
    todayLabel,
    nextOpeningLabel,
    posOpen: evaluation.isOpen,
    needsHoursAttention: false,
    syncFailed: false,
  };
}

function findNextOpeningLabel(week: VendorCustomerOrderingWeek, timeZone: string, now: Date): string | null {
  const startWeekday = getWeekdayInTimezone(now, timeZone);
  const startMinutes = getMinutesInTimezone(now, timeZone);
  const startIndex = VENDOR_WEEKDAYS.indexOf(startWeekday);

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (startIndex + offset) % 7;
    const day = VENDOR_WEEKDAYS[dayIndex]!;
    const row = week.find((d) => d.day === day);
    if (!row?.isOpen) continue;

    const openMin = businessTimeToMinutes(row.openTime);
    if (offset === 0 && startMinutes < openMin) {
      return `Opens today at ${formatMinutes12h(openMin)}`;
    }
    if (offset > 0) {
      const dayLabel = offset === 1 ? "tomorrow" : VENDOR_WEEKDAY_LABELS[day];
      return `Opens ${dayLabel} at ${formatMinutes12h(openMin)}`;
    }
  }

  return null;
}

export function serializeVendorCustomerOrderingWeek(week: VendorCustomerOrderingWeek): VendorCustomerOrderingWeek {
  return VENDOR_WEEKDAYS.map((day) => {
    const row = week.find((d) => d.day === day);
    return {
      day,
      isOpen: row?.isOpen ?? false,
      openTime: row?.openTime ?? "09:00",
      closeTime: row?.closeTime ?? "17:00",
    };
  });
}

/** Admin/debug: full hours evaluation for a vendor row. */
export function evaluateVendorCustomerOrderingHoursDebug(input: {
  customerOrderingHours: unknown;
  podPickupTimezone?: string | null;
  now?: Date;
}) {
  const week = parseActiveVendorCustomerOrderingWeek(input.customerOrderingHours);
  const timeZone = resolveVendorHoursTimezone(input.podPickupTimezone);
  return evaluateBusinessHours({ week, timeZone, now: input.now });
}
