import { describe, expect, it } from "vitest";
import { filterVendorOrdersForHistory } from "./vendor-orders-history-filters";

const nowMs = new Date("2026-06-04T15:00:00.000Z").getTime();

function order(overrides: Partial<{
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  totalRefundedCents: number;
}> = {}) {
  return {
    id: overrides.id ?? "vo1",
    routingStatus: overrides.routingStatus ?? "confirmed",
    fulfillmentStatus: overrides.fulfillmentStatus ?? "completed",
    order: { createdAt: overrides.createdAt ?? "2026-06-04T12:00:00.000Z", id: overrides.id ?? "order1" },
    totalRefundedCents: overrides.totalRefundedCents ?? 0,
    statusHistory: [],
  };
}

describe("filterVendorOrdersForHistory", () => {
  const orders = [
    order({ id: "today", createdAt: "2026-06-04T10:00:00.000Z" }),
    order({ id: "yesterday", createdAt: "2026-06-03T10:00:00.000Z" }),
    order({ id: "week", createdAt: "2026-06-01T10:00:00.000Z" }),
    order({ id: "refunded", totalRefundedCents: 500, fulfillmentStatus: "completed" }),
    order({ id: "failed", routingStatus: "failed", fulfillmentStatus: "cancelled" }),
  ];

  it("filters today terminal orders", () => {
    const result = filterVendorOrdersForHistory(orders, "today", nowMs);
    expect(result.map((o) => o.id)).toEqual(["today", "refunded", "failed"]);
  });

  it("filters this week terminal orders", () => {
    const result = filterVendorOrdersForHistory(orders, "this_week", nowMs);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("filters refunded orders", () => {
    const result = filterVendorOrdersForHistory(orders, "refunded", nowMs);
    expect(result.map((o) => o.id)).toEqual(["refunded"]);
  });
});
