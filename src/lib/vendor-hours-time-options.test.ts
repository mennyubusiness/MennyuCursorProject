import { describe, expect, it } from "vitest";
import {
  formatVendorHoursTimeLabel,
  snapVendorHoursTimeToOption,
  VENDOR_HOURS_TIME_OPTIONS,
} from "@/lib/vendor-hours-time-options";

describe("vendor hours time options", () => {
  it("includes 15-minute steps across the day", () => {
    expect(VENDOR_HOURS_TIME_OPTIONS[0]).toBe("00:00");
    expect(VENDOR_HOURS_TIME_OPTIONS).toContain("09:00");
    expect(VENDOR_HOURS_TIME_OPTIONS).toContain("21:00");
    expect(VENDOR_HOURS_TIME_OPTIONS.at(-1)).toBe("23:45");
    expect(VENDOR_HOURS_TIME_OPTIONS).toHaveLength(96);
  });

  it("formats times for display in 12-hour clock", () => {
    expect(formatVendorHoursTimeLabel("09:00")).toBe("9:00 AM");
    expect(formatVendorHoursTimeLabel("21:00")).toBe("9:00 PM");
    expect(formatVendorHoursTimeLabel("00:00")).toBe("12:00 AM");
  });

  it("snaps arbitrary minute values to the nearest option", () => {
    expect(snapVendorHoursTimeToOption("09:07")).toBe("09:00");
    expect(snapVendorHoursTimeToOption("09:08")).toBe("09:15");
  });
});
