import { describe, expect, it } from "vitest";
import {
  countActiveBoardGroups,
  getVendorOrderBoardGroupKey,
  groupVendorOrdersForBoard,
} from "./vendor-orders-board";

describe("getVendorOrderBoardGroupKey", () => {
  it("groups routed sent pending as preparing (active)", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "sent",
        fulfillmentStatus: "pending",
      })
    ).toBe("preparing");
  });

  it("groups routing failure pending as new (needs attention)", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "failed",
        fulfillmentStatus: "pending",
      })
    ).toBe("new");
  });

  it("groups accepted as preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "accepted",
      })
    ).toBe("preparing");
  });

  it("groups ready as ready", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "ready",
      })
    ).toBe("ready");
  });

  it("excludes completed from active columns", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "completed",
      })
    ).toBe("completed");
  });

  it("excludes cancelled from active columns", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "failed",
        fulfillmentStatus: "cancelled",
      })
    ).toBe("cancelled_failed");
  });
});

describe("groupVendorOrdersForBoard", () => {
  it("counts active kitchen columns", () => {
    const grouped = groupVendorOrdersForBoard([
      { routingStatus: "failed", fulfillmentStatus: "pending" },
      { routingStatus: "confirmed", fulfillmentStatus: "preparing" },
      { routingStatus: "confirmed", fulfillmentStatus: "ready" },
      { routingStatus: "confirmed", fulfillmentStatus: "completed" },
    ]);
    expect(countActiveBoardGroups(grouped)).toEqual({
      new: 1,
      preparing: 1,
      ready: 1,
    });
  });
});
