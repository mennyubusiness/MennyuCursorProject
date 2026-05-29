import { describe, expect, it } from "vitest";
import { buildTimelineEvents } from "./order-status-helpers";

describe("buildTimelineEvents", () => {
  const baseDate = new Date("2026-05-01T12:00:00Z");

  it("dedupes repeated parent status labels", () => {
    const events = buildTimelineEvents({
      statusHistory: [
        { status: "paid", createdAt: baseDate },
        { status: "routing", createdAt: new Date(baseDate.getTime() + 1000) },
        { status: "routed", createdAt: new Date(baseDate.getTime() + 2000) },
      ],
      vendorOrders: [],
    });
    expect(events.filter((e) => e.label === "Confirming your order")).toHaveLength(1);
  });

  it("skips duplicate vendor Received rows and uses customer-facing labels", () => {
    const events = buildTimelineEvents({
      statusHistory: [{ status: "routing", createdAt: baseDate }],
      vendorOrders: [
        {
          vendor: { name: "Taco Shop" },
          statusHistory: [
            {
              routingStatus: "pending",
              fulfillmentStatus: "pending",
              createdAt: baseDate,
            },
            {
              routingStatus: "sent",
              fulfillmentStatus: "pending",
              createdAt: new Date(baseDate.getTime() + 1000),
            },
            {
              routingStatus: "confirmed",
              fulfillmentStatus: "accepted",
              createdAt: new Date(baseDate.getTime() + 2000),
            },
          ],
        },
      ],
    });
    expect(events.some((e) => e.label.includes("Received"))).toBe(false);
    expect(events.filter((e) => e.label === "Taco Shop — Confirmed")).toHaveLength(0);
    expect(events.some((e) => e.label === "Confirming your order")).toBe(true);
  });

  it("dedupes repeated vendor milestone labels", () => {
    const events = buildTimelineEvents({
      statusHistory: [],
      vendorOrders: [
        {
          vendor: { name: "Burger Co" },
          statusHistory: [
            {
              routingStatus: "confirmed",
              fulfillmentStatus: "preparing",
              createdAt: baseDate,
            },
            {
              routingStatus: "confirmed",
              fulfillmentStatus: "preparing",
              createdAt: new Date(baseDate.getTime() + 5000),
            },
          ],
        },
      ],
    });
    expect(events.filter((e) => e.label === "Burger Co — Preparing")).toHaveLength(1);
  });
});
