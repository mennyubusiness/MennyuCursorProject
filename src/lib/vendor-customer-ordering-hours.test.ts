import { describe, expect, it } from "vitest";
import {
  defaultVendorCustomerOrderingWeek,
  formatDayHoursLabel,
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

  it("returns undefined when no hours are configured in custom mode", () => {
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

  it("returns false when sync is on but synced hours are missing", () => {
    expect(
      resolveVendorPosOpen(
        {
          syncCustomerOrderingHoursFromDeliverect: true,
          customerOrderingHours: week,
          deliverectSyncedCustomerOrderingHours: null,
        },
        "America/Chicago"
      )
    ).toBe(false);
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

describe("summarizeVendorCustomerOrderingHours", () => {
  const week = defaultVendorCustomerOrderingWeek();

  it("does not claim synced from Deliverect before hours exist", () => {
    const summary = summarizeVendorCustomerOrderingHours({
      vendor: {
        syncCustomerOrderingHoursFromDeliverect: true,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: null,
      },
      posConnected: true,
      timeZone: "America/Chicago",
    });
    expect(summary.sourceLabel).toBe("Hours sync needs attention");
    expect(summary.needsHoursAttention).toBe(true);
    expect(summary.posOpen).toBe(false);
  });

  it("shows synced label when cached hours exist", () => {
    const summary = summarizeVendorCustomerOrderingHours({
      vendor: {
        syncCustomerOrderingHoursFromDeliverect: true,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: week,
        deliverectSyncedCustomerOrderingHoursSyncStatus: "ok",
      },
      posConnected: true,
      timeZone: "America/Chicago",
    });
    expect(summary.sourceLabel).toBe("Synced from Deliverect");
    expect(summary.needsHoursAttention).toBe(false);
  });

  it("warns when latest sync failed but cached hours remain", () => {
    const summary = summarizeVendorCustomerOrderingHours({
      vendor: {
        syncCustomerOrderingHoursFromDeliverect: true,
        customerOrderingHours: week,
        deliverectSyncedCustomerOrderingHours: week,
        deliverectSyncedCustomerOrderingHoursSyncStatus: "failed",
      },
      posConnected: true,
      timeZone: "America/Chicago",
    });
    expect(summary.sourceLabel).toContain("latest sync failed");
    expect(summary.syncFailed).toBe(true);
    expect(summary.needsHoursAttention).toBe(true);
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
  it("returns false when synced hours are missing and sync is on", () => {
    expect(
      isVendorWithinCustomerOrderingHours({
        syncFromDeliverect: true,
        customHours: null,
        syncedHours: null,
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
    // Wed Jun 3 2026 20:00 UTC = 15:00 America/Chicago (open)
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

    // Wed Jun 3 2026 23:30 UTC = 18:30 America/Chicago (closed)
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
