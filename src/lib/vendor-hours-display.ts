import {
  formatDayHoursLabel,
  getWeekdayInTimezone,
  parseVendorCustomerOrderingWeek,
  type VendorCustomerOrderingWeek,
  type VendorWeekday,
  validateVendorCustomerOrderingWeek,
  VENDOR_WEEKDAY_LABELS,
  VENDOR_WEEKDAYS,
} from "@/lib/vendor-customer-ordering-hours";

export type VendorDayHoursDisplay = {
  dayKey: VendorWeekday;
  dayLabel: string;
  isToday: boolean;
  isClosed: boolean;
  displayText: string;
};

export type VendorHoursDisplayModel = {
  todayDisplayText: string;
  todayCollapsedLabel: string;
  weeklyDisplayRows: VendorDayHoursDisplay[];
  hasHours: boolean;
};

function resolveActiveCustomerOrderingWeek(raw: unknown): VendorCustomerOrderingWeek | null {
  const week = parseVendorCustomerOrderingWeek(raw);
  if (!week || validateVendorCustomerOrderingWeek(week) !== null) return null;
  return week;
}

function todayDisplayTextForRow(row: VendorCustomerOrderingWeek[number] | undefined): {
  displayText: string;
  isClosed: boolean;
} {
  if (!row) {
    return { displayText: "Hours unavailable", isClosed: true };
  }
  if (!row.isOpen) {
    return { displayText: "Closed", isClosed: true };
  }
  return { displayText: formatDayHoursLabel(row), isClosed: false };
}

/**
 * Normalizes vendor customer ordering hours into customer-facing collapsed/weekly copy.
 */
export function buildVendorHoursDisplay(input: {
  customerOrderingHours: unknown;
  timeZone: string;
  now?: Date;
}): VendorHoursDisplayModel {
  const week = resolveActiveCustomerOrderingWeek(input.customerOrderingHours);
  const now = input.now ?? new Date();
  const todayKey = getWeekdayInTimezone(now, input.timeZone);

  if (!week) {
    return {
      todayDisplayText: "Hours unavailable",
      todayCollapsedLabel: "Today: Hours unavailable",
      weeklyDisplayRows: [],
      hasHours: false,
    };
  }

  const todayRow = week.find((row) => row.day === todayKey);
  const { displayText: todayDisplayText } = todayDisplayTextForRow(todayRow);

  const weeklyDisplayRows: VendorDayHoursDisplay[] = VENDOR_WEEKDAYS.map((dayKey) => {
    const row = week.find((d) => d.day === dayKey);
    const isToday = dayKey === todayKey;
    if (!row) {
      return {
        dayKey,
        dayLabel: VENDOR_WEEKDAY_LABELS[dayKey],
        isToday,
        isClosed: true,
        displayText: "Hours unavailable",
      };
    }
    const closed = !row.isOpen;
    return {
      dayKey,
      dayLabel: VENDOR_WEEKDAY_LABELS[dayKey],
      isToday,
      isClosed: closed,
      displayText: closed ? "Closed" : formatDayHoursLabel(row),
    };
  });

  return {
    todayDisplayText,
    todayCollapsedLabel: `Today: ${todayDisplayText}`,
    weeklyDisplayRows,
    hasHours: true,
  };
}
