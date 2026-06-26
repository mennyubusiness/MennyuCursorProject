import { describe, expect, it } from "vitest";
import {
  mergeDeliverectDayIntervals,
  normalizeDeliverectOpeningHoursResponse,
} from "./opening-hours-api";

describe("normalizeDeliverectOpeningHoursResponse", () => {
  it("maps location opening hours by day of week", () => {
    const body = {
      _items: [
        {
          openingHours: [
            { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: 2, startTime: "10:00", endTime: "20:00" },
          ],
          timezone: "America/Chicago",
        },
      ],
    };

    const normalized = normalizeDeliverectOpeningHoursResponse(body);
    expect(normalized?.timezone).toBe("America/Chicago");
    expect(normalized?.week.find((d) => d.day === "monday")).toMatchObject({
      isOpen: true,
      openTime: "09:00",
      closeTime: "17:00",
    });
    expect(normalized?.week.find((d) => d.day === "sunday")?.isOpen).toBe(false);
  });

  it("prefers channel-specific hours when channel link id matches", () => {
    const body = {
      openingHours: [{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }],
      channels: [
        {
          id: "channel-1",
          openingHours: [{ dayOfWeek: 1, startTime: "11:00", endTime: "22:00" }],
        },
      ],
    };

    const normalized = normalizeDeliverectOpeningHoursResponse(body, "channel-1");
    expect(normalized?.week.find((d) => d.day === "monday")).toMatchObject({
      isOpen: true,
      openTime: "11:00",
      closeTime: "22:00",
    });
  });
});

describe("mergeDeliverectDayIntervals", () => {
  it("merges multiple intervals on the same day", () => {
    const merged = mergeDeliverectDayIntervals([
      { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "17:00", endTime: "22:00" },
    ]);
    expect(merged.get("monday")).toMatchObject({
      openTime: "08:00",
      closeTime: "22:00",
    });
  });
});
