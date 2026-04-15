import { describe, expect, it } from "vitest";
import { parseDeliverectInboundPickupUtc } from "./deliverect-pickup-time-parse";

describe("parseDeliverectInboundPickupUtc", () => {
  it("parses Z suffix as UTC", () => {
    const d = parseDeliverectInboundPickupUtc("2025-06-01T12:00:00.000Z");
    expect(d?.toISOString()).toBe("2025-06-01T12:00:00.000Z");
  });

  it("treats naive ISO datetime as UTC wall time (not host local)", () => {
    const d = parseDeliverectInboundPickupUtc("2025-06-01T12:00:00");
    expect(d?.toISOString()).toBe("2025-06-01T12:00:00.000Z");
  });

  it("treats naive ISO with fractional seconds as UTC", () => {
    const d = parseDeliverectInboundPickupUtc("2025-06-01T12:00:00.131438");
    expect(d?.toISOString()).toBe("2025-06-01T12:00:00.131Z");
  });

  it("respects explicit numeric offset", () => {
    const d = parseDeliverectInboundPickupUtc("2025-06-01T07:00:00-05:00");
    expect(d?.toISOString()).toBe("2025-06-01T12:00:00.000Z");
  });

  it("returns null for empty or invalid", () => {
    expect(parseDeliverectInboundPickupUtc("")).toBeNull();
    expect(parseDeliverectInboundPickupUtc("not-a-date")).toBeNull();
  });
});
