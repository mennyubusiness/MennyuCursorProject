import { describe, expect, it } from "vitest";
import { formatPickupDetailLine, formatPickupSmsFragment } from "./pickup-display";

describe("pickup display", () => {
  it("formats ASAP when no scheduled time", () => {
    expect(formatPickupDetailLine(null, "America/New_York")).toBe("Pickup · ASAP");
    expect(formatPickupSmsFragment(null, "America/New_York")).toBe("ASAP pickup");
  });

  it("formats ASAP with POS estimated ready time without implying scheduled checkout", () => {
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const line = formatPickupDetailLine(null, "America/New_York", eta);
    expect(line).toContain("ASAP");
    expect(line).toContain("Est. ready");
    expect(line).not.toContain("Scheduled for");
    const sms = formatPickupSmsFragment(null, "America/New_York", eta);
    expect(sms).toContain("ASAP pickup");
    expect(sms).toContain("est. ready");
  });

  it("customer scheduled time wins over Deliverect ETA if both present", () => {
    const scheduled = new Date("2025-06-02T18:00:00.000Z");
    const eta = new Date("2025-06-01T14:00:00.000Z");
    const line = formatPickupDetailLine(scheduled, "America/New_York", eta);
    expect(line).toContain("Scheduled for");
    expect(line).not.toContain("Est. ready");
  });

  it("formats scheduled pickup in the given IANA timezone", () => {
    const d = new Date("2025-06-01T14:00:00.000Z");
    expect(formatPickupDetailLine(d, "America/New_York")).toContain("Scheduled for");
    expect(formatPickupDetailLine(d, "America/New_York")).toContain("Jun");
    expect(formatPickupSmsFragment(d, "America/New_York")).toContain("Scheduled pickup");
  });

  it("order history uses same detail line as order page (stable prefixes)", () => {
    expect(formatPickupDetailLine(null, "America/Chicago")).toMatch(/^Pickup · ASAP$/);
    const line = formatPickupDetailLine(new Date("2025-07-04T17:00:00.000Z"), "America/Chicago");
    expect(line.startsWith("Pickup · Scheduled for ")).toBe(true);
  });

  it("SMS fragment uses compact scheduled wording", () => {
    const sms = formatPickupSmsFragment(new Date("2025-07-04T17:00:00.000Z"), "America/Chicago");
    expect(sms.startsWith("Scheduled pickup ")).toBe(true);
    expect(sms).not.toContain("Pickup ·");
  });
});
