import { describe, expect, it } from "vitest";
import {
  defaultVendorCustomerOrderingWeek,
  formatDayHoursLabel,
  isVendorWithinCustomerOrderingHours,
  parseVendorCustomerOrderingWeek,
  resolveVendorPosOpen,
  validateVendorCustomerOrderingWeek,
} from "./vendor-customer-ordering-hours";

describe("validateVendorCustomerOrderingWeek", () => {
  it("requires closing after opening", () => {
    const week = defaultVendorCustomerOrderingWeek().map((row) =>
      row.day === "monday" ? { ...row, openTime: "18:00", closeTime: "09:00" } : row
    );
    expect(validateVendorCustomerOrderingWeek(week)).toMatch(/closing time must be after opening/i);
  });

  it("requires at least one open day", () => {
    const week = defaultVendorCustomerOrderingWeek().map((row) => ({ ...row, isOpen: false }));
    expect(validateVendorCustomerOrderingWeek(week)).toMatch(/At least one day must be open/i);
  });
});

describe("resolveVendorPosOpen", () => {
  const week = defaultVendorCustomerOrderingWeek();

  it("returns undefined when no hours are configured", () => {
    expect(
      resolveVendorPosOpen(
        {
          syncCustomerOrderingHoursFromDeliverect: false,
          customerOrderingHours: null,
          deliverectSyncedCustomerOrderingHours: null,
        },
        "America/Chicago"
      )
    ).toBeUndefined();
  });

  it("uses custom hours when sync is off", () => {
    const mondayMorning = new Date("2026-06-01T14:00:00.000Z");
    const posOpen = resolveVendorPosOpen(
      {
        syncCustomerOrderingHoursFromDeliverect: false,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: null,
      },
      "America/Chicago",
      mondayMorning
    );
    expect(posOpen).toBe(true);
  });

  it("uses synced hours when sync is on", () => {
    const closedWeek = week.map((row) => ({ ...row, isOpen: false }));
    const posOpen = resolveVendorPosOpen(
      {
        syncCustomerOrderingHoursFromDeliverect: true,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: closedWeek,
      },
      "America/Chicago",
      new Date("2026-06-01T14:00:00.000Z")
    );
    expect(posOpen).toBe(false);
  });
});

describe("formatDayHoursLabel", () => {
  it("shows Closed for closed days", () => {
    expect(
      formatDayHoursLabel({
        day: "monday",
        isOpen: false,
        openTime: "09:00",
        closeTime: "17:00",
      })
    ).toBe("Closed");
  });
});

describe("parseVendorCustomerOrderingWeek", () => {
  it("normalizes partial input to full week", () => {
    const parsed = parseVendorCustomerOrderingWeek([
      { day: "monday", isOpen: true, openTime: "10:00", closeTime: "20:00" },
    ]);
    expect(parsed).toHaveLength(7);
    expect(parsed?.[0]).toMatchObject({ day: "monday", isOpen: true });
    expect(parsed?.[1]?.isOpen).toBe(false);
  });
});

describe("isVendorWithinCustomerOrderingHours", () => {
  it("returns undefined when synced hours are missing", () => {
    expect(
      isVendorWithinCustomerOrderingHours({
        syncFromDeliverect: true,
        customHours: null,
        syncedHours: null,
        timeZone: "America/Chicago",
      })
    ).toBeUndefined();
  });
});
