import { describe, expect, it } from "vitest";
import {
  PICKUP_MIN_LEAD_MINUTES,
  validateScheduledPickup,
  wallTimeInZoneToUtc,
} from "./pickup-scheduling";

describe("pickup-scheduling", () => {
  it("wallTimeInZoneToUtc maps America/New_York wall time to UTC", () => {
    const d = wallTimeInZoneToUtc(2025, 6, 1, 10, 0, "America/New_York");
    expect(d.toISOString()).toBe("2025-06-01T14:00:00.000Z");
  });

  it("validateScheduledPickup rejects times before minimum lead", () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    const tooSoon = new Date(now.getTime() + (PICKUP_MIN_LEAD_MINUTES - 1) * 60 * 1000);
    const r = validateScheduledPickup(tooSoon, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PICKUP_TOO_SOON");
  });

  it("validateScheduledPickup accepts time at minimum lead", () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    const ok = new Date(now.getTime() + PICKUP_MIN_LEAD_MINUTES * 60 * 1000);
    expect(validateScheduledPickup(ok, now)).toEqual({ ok: true });
  });
});
