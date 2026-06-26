/**
 * Vendor customer-facing ordering hours — custom Open Order schedule or synced Deliverect/POS hours.
 */

export const VENDOR_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

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
    const openMin = timeToMinutes(row.openTime);
    const closeMin = timeToMinutes(row.closeTime);
    if (closeMin <= openMin) {
      return `${VENDOR_WEEKDAY_LABELS[row.day]}: closing time must be after opening time.`;
    }
  }

  if (openDayCount === 0) {
    return "At least one day must be open for customer ordering.";
  }

  return null;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  return h * 60 + m;
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
  return `${formatMinutes12h(timeToMinutes(row.openTime))} – ${formatMinutes12h(timeToMinutes(row.closeTime))}`;
}

export function getWeekdayInTimezone(now: Date, timeZone: string): VendorWeekday {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now).toLowerCase();
  return weekday as VendorWeekday;
}

export function getMinutesInTimezone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isOpenAtTime(
  week: VendorCustomerOrderingWeek,
  weekday: VendorWeekday,
  minutes: number
): boolean {
  const row = week.find((d) => d.day === weekday);
  if (!row?.isOpen) return false;
  const openMin = timeToMinutes(row.openTime);
  const closeMin = timeToMinutes(row.closeTime);
  return minutes >= openMin && minutes < closeMin;
}

/**
 * Returns whether the vendor is within customer ordering hours.
 * undefined = no hours configured for the active source (custom mode only — do not block orderability).
 * false = sync mode enabled but no usable synced hours, or currently outside hours.
 */
export function isVendorWithinCustomerOrderingHours(input: {
  syncFromDeliverect: boolean;
  customHours: VendorCustomerOrderingWeek | null;
  syncedHours: VendorCustomerOrderingWeek | null;
  timeZone: string;
  now?: Date;
}): boolean | undefined {
  if (input.syncFromDeliverect) {
    if (!input.syncedHours) return false;
    const now = input.now ?? new Date();
    const weekday = getWeekdayInTimezone(now, input.timeZone);
    const minutes = getMinutesInTimezone(now, input.timeZone);
    return isOpenAtTime(input.syncedHours, weekday, minutes);
  }

  const week = input.customHours;
  if (!week) return undefined;

  const now = input.now ?? new Date();
  const weekday = getWeekdayInTimezone(now, input.timeZone);
  const minutes = getMinutesInTimezone(now, input.timeZone);
  return isOpenAtTime(week, weekday, minutes);
}

export function resolveVendorPosOpen(
  vendor: VendorHoursSourceFields,
  timeZone: string,
  now?: Date
): boolean | undefined {
  const customHours = parseVendorCustomerOrderingWeek(vendor.customerOrderingHours);
  const syncedHours = parseVendorCustomerOrderingWeek(vendor.deliverectSyncedCustomerOrderingHours);

  return isVendorWithinCustomerOrderingHours({
    syncFromDeliverect: vendor.syncCustomerOrderingHoursFromDeliverect,
    customHours,
    syncedHours,
    timeZone,
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
  return {
    isActive: vendor.isActive,
    mennyuOrdersPaused: vendor.mennyuOrdersPaused,
    deliverectChannelLinkId: vendor.deliverectChannelLinkId,
    posOpen: resolveVendorPosOpen(vendor, resolveVendorHoursTimezone(podTimezone), now),
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
  vendor: VendorHoursSourceFields;
  posConnected: boolean;
  timeZone: string;
  now?: Date;
}): VendorHoursStatusSummary {
  const now = input.now ?? new Date();
  const customHours = parseVendorCustomerOrderingWeek(input.vendor.customerOrderingHours);
  const syncedHours = parseVendorCustomerOrderingWeek(input.vendor.deliverectSyncedCustomerOrderingHours);
  const syncOn = input.vendor.syncCustomerOrderingHoursFromDeliverect;
  const syncFailed = input.vendor.deliverectSyncedCustomerOrderingHoursSyncStatus === "failed";
  const activeWeek = syncOn ? syncedHours : customHours;

  const posOpen = isVendorWithinCustomerOrderingHours({
    syncFromDeliverect: syncOn,
    customHours,
    syncedHours,
    timeZone: input.timeZone,
    now,
  });

  if (syncOn) {
    if (!input.posConnected) {
      return {
        sourceLabel: "Deliverect sync selected",
        todayLabel: "Connect your POS to sync customer ordering hours.",
        nextOpeningLabel: null,
        posOpen,
        needsHoursAttention: true,
        syncFailed: false,
      };
    }
    if (!syncedHours) {
      return {
        sourceLabel: "Hours sync needs attention",
        todayLabel: "No synced hours are available yet.",
        nextOpeningLabel: null,
        posOpen: false,
        needsHoursAttention: true,
        syncFailed,
      };
    }
  } else if (!customHours) {
    return {
      sourceLabel: "Custom hours not set",
      todayLabel: "Customer ordering hours are not configured yet.",
      nextOpeningLabel: null,
      posOpen,
      needsHoursAttention: true,
      syncFailed: false,
    };
  }

  const weekday = getWeekdayInTimezone(now, input.timeZone);
  const todayRow = activeWeek?.find((d) => d.day === weekday);
  const minutes = getMinutesInTimezone(now, input.timeZone);
  const openNow = activeWeek ? isOpenAtTime(activeWeek, weekday, minutes) : undefined;

  let todayLabel = "Closed today";
  if (todayRow?.isOpen) {
    todayLabel = openNow
      ? `Open until ${formatMinutes12h(timeToMinutes(todayRow.closeTime))}`
      : `Closed · hours ${formatDayHoursLabel(todayRow)}`;
  } else if (todayRow) {
    todayLabel = "Closed today";
  }

  const nextOpeningLabel = activeWeek ? findNextOpeningLabel(activeWeek, input.timeZone, now) : null;

  let sourceLabel = "Custom Open Order hours";
  if (syncOn) {
    sourceLabel = syncFailed ? "Synced from Deliverect · latest sync failed" : "Synced from Deliverect";
  }

  return {
    sourceLabel,
    todayLabel,
    nextOpeningLabel,
    posOpen,
    needsHoursAttention: syncOn ? syncFailed : false,
    syncFailed: syncOn ? syncFailed : false,
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

    const openMin = timeToMinutes(row.openTime);
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

export function resolveVendorHoursTimezone(podTimezone: string | null | undefined): string {
  const trimmed = podTimezone?.trim();
  if (trimmed) return trimmed;
  return process.env.DEFAULT_PICKUP_TIMEZONE?.trim() || "America/Chicago";
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
