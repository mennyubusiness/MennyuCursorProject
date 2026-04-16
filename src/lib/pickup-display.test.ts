import { describe, expect, it } from "vitest";
import {
  formatPickupDetailLine,
  formatPickupSmsFragment,
  formatPickupSummaryScheduledLead,
  getDisplayPickupTime,
  type OrderPickupDisplayInput,
} from "./pickup-display";

function order(
  tz: string,
  requested?: Date | string | null,
  estimated?: Date | string | null
): OrderPickupDisplayInput {
  return {
    requestedPickupAt: requested ?? null,
    deliverectEstimatedReadyAt: estimated ?? null,
    resolvedPickupTimezone: tz,
  };
}

describe("getDisplayPickupTime", () => {
  it("prefers scheduled over Deliverect ETA", () => {
    const scheduled = new Date("2025-06-02T18:00:00.000Z");
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const r = getDisplayPickupTime(order("America/New_York", scheduled, eta));
    expect(r.mode).toBe("scheduled");
    expect(r.instant?.toISOString()).toBe(scheduled.toISOString());
  });

  it("uses Deliverect ETA when not scheduled", () => {
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const r = getDisplayPickupTime(order("America/New_York", null, eta));
    expect(r.mode).toBe("estimated_ready");
    expect(r.instant?.toISOString()).toBe(eta.toISOString());
  });

  it("returns asap when neither time exists", () => {
    const r = getDisplayPickupTime(order("America/New_York", null, null));
    expect(r.mode).toBe("asap");
    expect(r.instant).toBeNull();
  });
});

describe("formatPickupSummaryScheduledLead", () => {
  it("returns null when not a scheduled order", () => {
    expect(formatPickupSummaryScheduledLead(order("America/New_York", null, null))).toBeNull();
  });

  it("includes the same wall time as the detail line", () => {
    const d = new Date("2025-07-04T17:00:00.000Z");
    const o = order("America/Chicago", d, null);
    const lead = formatPickupSummaryScheduledLead(o);
    expect(lead).toContain("Your pickup is scheduled for");
    expect(lead).toContain("Jul");
  });
});

describe("pickup display", () => {
  it("formats ASAP when no scheduled time", () => {
    expect(formatPickupDetailLine(order("America/New_York", null, null))).toBe("Pickup · ASAP");
    expect(formatPickupSmsFragment(order("America/New_York", null, null))).toBe("ASAP pickup");
  });

  it("formats ASAP with POS estimated ready time without implying scheduled checkout", () => {
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const line = formatPickupDetailLine(order("America/New_York", null, eta));
    expect(line).toContain("ASAP");
    expect(line).toContain("Est. ready");
    expect(line).not.toContain("Scheduled for");
    const sms = formatPickupSmsFragment(order("America/New_York", null, eta));
    expect(sms).toContain("ASAP pickup");
    expect(sms).toContain("est. ready");
  });

  it("customer scheduled time wins over Deliverect ETA if both present", () => {
    const scheduled = new Date("2025-06-02T18:00:00.000Z");
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const line = formatPickupDetailLine(order("America/New_York", scheduled, eta));
    expect(line).toContain("Scheduled for");
    expect(line).not.toContain("Est. ready");
  });

  it("formats scheduled pickup in the given IANA timezone", () => {
    const d = new Date("2025-06-01T14:00:00.000Z");
    expect(formatPickupDetailLine(order("America/New_York", d, null))).toContain("Scheduled for");
    expect(formatPickupDetailLine(order("America/New_York", d, null))).toContain("Jun");
    expect(formatPickupSmsFragment(order("America/New_York", d, null))).toContain("Scheduled pickup");
  });

  it("order history uses same detail line as order page (stable prefixes)", () => {
    expect(formatPickupDetailLine(order("America/Chicago", null, null))).toMatch(/^Pickup · ASAP$/);
    const line = formatPickupDetailLine(order("America/Chicago", new Date("2025-07-04T17:00:00.000Z"), null));
    expect(line.startsWith("Pickup · Scheduled for ")).toBe(true);
  });

  it("SMS fragment uses compact scheduled wording", () => {
    const sms = formatPickupSmsFragment(order("America/Chicago", new Date("2025-07-04T17:00:00.000Z"), null));
    expect(sms.startsWith("Scheduled pickup ")).toBe(true);
    expect(sms).not.toContain("Pickup ·");
  });
});
