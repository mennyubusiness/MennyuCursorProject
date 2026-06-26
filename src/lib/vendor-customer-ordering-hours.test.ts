import { describe, expect, it } from "vitest";
import {
  defaultVendorCustomerOrderingWeek,
  formatDayHoursLabel,
  hasValidVendorCustomerOrderingHours,
  isVendorWithinCustomerOrderingHours,
  parseVendorCustomerOrderingWeek,
  resolveVendorPosOpen,
  summarizeVendorCustomerOrderingHours,
  validateVendorCustomerOrderingWeek,
  vendorAvailabilityWithCustomerOrderingHours,
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

  it("returns false when no manual hours are configured", () => {
    expect(
      resolveVendorPosOpen(
        {
          syncCustomerOrderingHoursFromDeliverect: true,
          customerOrderingHours: null,
          deliverectSyncedCustomerOrderingHours: week,
        },
        "America/Chicago"
      )
    ).toBe(false);
  });

  it("uses manual hours and ignores Deliverect synced hours", () => {
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
    expect(posOpen).toBe(true);
  });

  it("returns false outside configured open windows", () => {
    const wednesdayOnly = week.map((row) =>
      row.day === "wednesday"
        ? { ...row, isOpen: true, openTime: "09:00", closeTime: "17:00" }
        : { ...row, isOpen: false }
    );
    expect(
      resolveVendorPosOpen(
        {
          syncCustomerOrderingHoursFromDeliverect: false,
          customerOrderingHours: wednesdayOnly,
          deliverectSyncedCustomerOrderingHours: null,
        },
        "America/Chicago",
        new Date("2026-06-01T14:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("summarizeVendorCustomerOrderingHours", () => {
  const week = defaultVendorCustomerOrderingWeek();

  it("shows hours need setup when manual hours are missing", () => {
    const summary = summarizeVendorCustomerOrderingHours({
      vendor: { customerOrderingHours: null },
      timeZone: "America/Chicago",
    });
    expect(summary.sourceLabel).toBe("Hours need setup");
    expect(summary.todayLabel).toBe("Hours need setup");
    expect(summary.needsHoursAttention).toBe(true);
    expect(summary.posOpen).toBe(false);
  });

  it("shows customer ordering hours when manual hours exist", () => {
    const summary = summarizeVendorCustomerOrderingHours({
      vendor: { customerOrderingHours: week },
      timeZone: "America/Chicago",
      now: new Date("2026-06-01T14:00:00.000Z"),
    });
    expect(summary.sourceLabel).toBe("Customer ordering hours");
    expect(summary.needsHoursAttention).toBe(false);
    expect(summary.syncFailed).toBe(false);
  });
});

describe("hasValidVendorCustomerOrderingHours", () => {
  it("accepts a valid saved week", () => {
    expect(hasValidVendorCustomerOrderingHours(defaultVendorCustomerOrderingWeek())).toBe(true);
  });

  it("rejects empty input", () => {
    expect(hasValidVendorCustomerOrderingHours(null)).toBe(false);
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

describe("isVendorWithinCustomerOrderingHours", () => {
  it("returns false when manual hours are missing", () => {
    expect(
      isVendorWithinCustomerOrderingHours({
        customHours: null,
        timeZone: "America/Chicago",
      })
    ).toBe(false);
  });
});

describe("vendorAvailabilityWithCustomerOrderingHours", () => {
  it("uses pod timezone for open/close boundaries", () => {
    const week = defaultVendorCustomerOrderingWeek().map((row) =>
      row.day === "wednesday"
        ? { ...row, isOpen: true, openTime: "09:00", closeTime: "17:00" }
        : { ...row, isOpen: false }
    );
    const openNow = vendorAvailabilityWithCustomerOrderingHours(
      {
        isActive: true,
        mennyuOrdersPaused: false,
        syncCustomerOrderingHoursFromDeliverect: false,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: null,
      },
      "America/Chicago",
      new Date("2026-06-03T20:00:00.000Z")
    );
    expect(openNow.posOpen).toBe(true);

    const closedNow = vendorAvailabilityWithCustomerOrderingHours(
      {
        isActive: true,
        mennyuOrdersPaused: false,
        syncCustomerOrderingHoursFromDeliverect: false,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: null,
      },
      "America/Chicago",
      new Date("2026-06-03T23:30:00.000Z")
    );
    expect(closedNow.posOpen).toBe(false);
  });
});
