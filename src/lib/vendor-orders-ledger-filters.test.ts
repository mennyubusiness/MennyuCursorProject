import { describe, expect, it } from "vitest";
import {
  filterVendorOrdersLedger,
  groupIssuesByVendorOrderId,
  isActiveLedgerOrder,
  parseVendorOrdersLedgerFilter,
  sortVendorOrdersLedgerNewestFirst,
} from "./vendor-orders-ledger-filters";

const baseOrder = {
  id: "vo_1",
  routingStatus: "confirmed",
  fulfillmentStatus: "preparing",
  order: { id: "ord_1", createdAt: "2026-06-04T18:00:00.000Z", orderNotes: null, customerPhone: null },
  lineItems: [],
  totalCents: 1200,
};

describe("vendor-orders-ledger-filters", () => {
  it("parses ledger filter query values", () => {
    expect(parseVendorOrdersLedgerFilter("issues")).toBe("issues");
    expect(parseVendorOrdersLedgerFilter("active")).toBe("active");
    expect(parseVendorOrdersLedgerFilter(null)).toBe("all");
  });

  it("sorts newest first", () => {
    const sorted = sortVendorOrdersLedgerNewestFirst([
      { ...baseOrder, id: "old", order: { ...baseOrder.order, createdAt: "2026-06-01T12:00:00.000Z" } },
      { ...baseOrder, id: "new", order: { ...baseOrder.order, createdAt: "2026-06-04T12:00:00.000Z" } },
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["new", "old"]);
  });

  it("filters active orders", () => {
    const orders = [
      baseOrder,
      {
        ...baseOrder,
        id: "vo_done",
        fulfillmentStatus: "completed",
        routingStatus: "confirmed",
      },
    ];
    const result = filterVendorOrdersLedger(
      orders,
      "active",
      "all",
      Date.parse("2026-06-04T20:00:00.000Z"),
      false,
      new Map(),
      ""
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("vo_1");
    expect(isActiveLedgerOrder(baseOrder)).toBe(true);
  });

  it("groups issues by vendor order id", () => {
    const map = groupIssuesByVendorOrderId([
      {
        id: "iss_1",
        vendorOrderId: "vo_1",
      } as import("@/services/vendor-order-issue.service").VendorOrderIssueRow,
    ]);
    expect(map.get("vo_1")).toHaveLength(1);
  });
});
