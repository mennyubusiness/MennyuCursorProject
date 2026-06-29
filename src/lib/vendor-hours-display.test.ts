import { describe, expect, it } from "vitest";
import { defaultVendorCustomerOrderingWeek } from "@/lib/vendor-customer-ordering-hours";
import { buildVendorHoursDisplay } from "@/lib/vendor-hours-display";

describe("buildVendorHoursDisplay", () => {
  const week = defaultVendorCustomerOrderingWeek().map((row) =>
    row.day === "sunday" ? { ...row, isOpen: false } : row
  );

  it("shows today's formatted hours when valid week is configured", () => {
    const display = buildVendorHoursDisplay({
      customerOrderingHours: week,
      timeZone: "America/Chicago",
      now: new Date("2026-06-01T14:00:00.000Z"),
    });

    expect(display.hasHours).toBe(true);
    expect(display.todayDisplayText).toMatch(/\d:\d{2} AM – \d:\d{2} PM/);
    expect(display.todayCollapsedLabel).toBe(`Today: ${display.todayDisplayText}`);
    expect(display.weeklyDisplayRows).toHaveLength(7);
  });

  it("marks today as closed when the current day is closed", () => {
    const display = buildVendorHoursDisplay({
      customerOrderingHours: week,
      timeZone: "America/Chicago",
      now: new Date("2026-06-07T14:00:00.000Z"),
    });

    expect(display.todayDisplayText).toBe("Closed");
    expect(display.todayCollapsedLabel).toBe("Today: Closed");
    const todayRow = display.weeklyDisplayRows.find((row) => row.isToday);
    expect(todayRow?.isClosed).toBe(true);
    expect(todayRow?.displayText).toBe("Closed");
  });

  it("returns unavailable copy when hours are missing or invalid", () => {
    const display = buildVendorHoursDisplay({
      customerOrderingHours: null,
      timeZone: "America/Chicago",
    });

    expect(display.hasHours).toBe(false);
    expect(display.todayCollapsedLabel).toBe("Today: Hours unavailable");
    expect(display.weeklyDisplayRows).toHaveLength(0);
  });

  it("renders a full weekly schedule with today highlighted", () => {
    const display = buildVendorHoursDisplay({
      customerOrderingHours: week,
      timeZone: "America/Chicago",
      now: new Date("2026-06-04T14:00:00.000Z"),
    });

    expect(display.weeklyDisplayRows.filter((row) => row.isToday)).toHaveLength(1);
    expect(display.weeklyDisplayRows.find((row) => row.dayKey === "sunday")?.displayText).toBe(
      "Closed"
    );
    expect(display.weeklyDisplayRows.every((row) => row.dayLabel.length > 0)).toBe(true);
  });

  it("uses timezone-aware weekday selection", () => {
    const mondayOnly = defaultVendorCustomerOrderingWeek().map((row) =>
      row.day === "monday"
        ? { ...row, isOpen: true, openTime: "09:00", closeTime: "17:00" }
        : { ...row, isOpen: false }
    );

    const mondayInChicago = buildVendorHoursDisplay({
      customerOrderingHours: mondayOnly,
      timeZone: "America/Chicago",
      now: new Date("2026-06-02T03:00:00.000Z"),
    });
    expect(mondayInChicago.todayDisplayText).toMatch(/9:00 AM – 5:00 PM/);

    const tuesdayInChicago = buildVendorHoursDisplay({
      customerOrderingHours: mondayOnly,
      timeZone: "America/Chicago",
      now: new Date("2026-06-02T14:00:00.000Z"),
    });
    expect(tuesdayInChicago.todayDisplayText).toBe("Closed");
  });
});
