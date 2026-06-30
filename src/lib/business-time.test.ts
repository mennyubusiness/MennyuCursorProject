import { describe, expect, it } from "vitest";
import {
  BUSINESS_HOURS_CLOSE_RULE,
  DEFAULT_BUSINESS_TIMEZONE,
  evaluateBusinessHours,
  getBusinessLocalClock,
  getMinutesInTimezone,
  isOpenAtMinutes,
  isOpenAtTime,
  isWithinBusinessHours,
  resolveBusinessTimezone,
} from "@/lib/business-time";

const LA = "America/Los_Angeles";
const DENVER = "America/Denver";

function laWeekdayHours(closeTime = "21:00") {
  return [
    { day: "monday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "tuesday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "wednesday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "thursday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "friday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "saturday" as const, isOpen: true, openTime: "11:00", closeTime },
    { day: "sunday" as const, isOpen: false, openTime: "11:00", closeTime },
  ];
}

/** 8:00 PM Pacific during PDT (June) */
const EIGHT_PM_PACIFIC_SUMMER = new Date("2026-06-16T03:00:00.000Z");
/** 9:00 PM Pacific during PDT */
const NINE_PM_PACIFIC_SUMMER = new Date("2026-06-16T04:00:00.000Z");
/** 8:00 PM Pacific during PST (January) = 04:00 UTC next day */
const EIGHT_PM_PACIFIC_WINTER = new Date("2026-01-16T04:00:00.000Z");

describe("resolveBusinessTimezone", () => {
  it("defaults to America/Los_Angeles when pod timezone is unset", () => {
    expect(resolveBusinessTimezone({})).toBe(DEFAULT_BUSINESS_TIMEZONE);
    expect(DEFAULT_BUSINESS_TIMEZONE).toBe("America/Los_Angeles");
  });

  it("uses pod pickup timezone when set", () => {
    expect(resolveBusinessTimezone({ podPickupTimezone: "America/Chicago" })).toBe("America/Chicago");
  });

  it("falls back for invalid timezone strings", () => {
    expect(resolveBusinessTimezone({ podPickupTimezone: "Not/A/Zone" })).toBe(DEFAULT_BUSINESS_TIMEZONE);
  });
});

describe("9 PM close regression (America/Los_Angeles)", () => {
  const week = laWeekdayHours("21:00");

  it("is OPEN at 8:00 PM Pacific (summer DST)", () => {
    expect(
      isWithinBusinessHours({ week, timeZone: LA, now: EIGHT_PM_PACIFIC_SUMMER })
    ).toBe(true);
  });

  it("is CLOSED at 9:00 PM Pacific — exclusive close rule", () => {
    expect(
      isWithinBusinessHours({ week, timeZone: LA, now: NINE_PM_PACIFIC_SUMMER })
    ).toBe(false);
  });

  it("is OPEN at 8:00 PM Pacific (winter standard time)", () => {
    expect(
      isWithinBusinessHours({ week, timeZone: LA, now: EIGHT_PM_PACIFIC_WINTER })
    ).toBe(true);
  });

  it("does not mark closed at 8 PM when pod timezone wrongly uses Mountain (bug reproduction)", () => {
    const at8pm = EIGHT_PM_PACIFIC_SUMMER;
    const minsDenver = getMinutesInTimezone(at8pm, DENVER);
    expect(minsDenver).toBe(21 * 60);
    expect(isWithinBusinessHours({ week, timeZone: DENVER, now: at8pm })).toBe(false);

    expect(isWithinBusinessHours({ week, timeZone: LA, now: at8pm })).toBe(true);
  });
});

describe("day-of-week in business timezone", () => {
  it("uses Pacific weekday when UTC has rolled to next calendar day", () => {
    const clock = getBusinessLocalClock(EIGHT_PM_PACIFIC_SUMMER, LA);
    expect(clock.weekday).toBe("monday");
    expect(clock.hour).toBe(20);
  });
});

describe("overnight hours", () => {
  const overnight = [
    { day: "friday" as const, isOpen: true, openTime: "17:00", closeTime: "01:00" },
  ];

  it("is open at 8 PM during overnight window", () => {
    expect(isOpenAtTime(overnight, "friday", 20 * 60)).toBe(true);
  });

  it("is open at 12:30 AM before 1 AM close", () => {
    expect(isOpenAtMinutes(overnight[0]!, 30)).toBe(true);
  });

  it("is closed at 1 AM with exclusive close rule", () => {
    expect(isOpenAtMinutes(overnight[0]!, 60)).toBe(false);
  });
});

describe("evaluateBusinessHours debug payload", () => {
  it("returns reason codes for missing and closed states", () => {
    const missing = evaluateBusinessHours({ week: null, timeZone: LA });
    expect(missing.reasonCode).toBe("missing_hours");
    expect(missing.isOpen).toBe(false);

    const closed = evaluateBusinessHours({
      week: laWeekdayHours(),
      timeZone: LA,
      now: NINE_PM_PACIFIC_SUMMER,
    });
    expect(closed.reasonCode).toBe("closed_after_close");
    expect(closed.closeRule).toBe(BUSINESS_HOURS_CLOSE_RULE);
    expect(closed.timeZone).toBe(LA);
    expect(closed.serverUtcIso).toBeTruthy();
    expect(closed.businessLocalLabel).toMatch(/9/i);
  });
});

describe("closed day", () => {
  it("returns closed_today on Sunday when Sunday is closed", () => {
    const sundayAfternoonPacific = new Date("2026-06-14T21:00:00.000Z");
    const result = evaluateBusinessHours({
      week: laWeekdayHours(),
      timeZone: LA,
      now: sundayAfternoonPacific,
    });
    expect(result.clock.weekday).toBe("sunday");
    expect(result.isOpen).toBe(false);
    expect(result.reasonCode).toBe("closed_today");
  });
});
