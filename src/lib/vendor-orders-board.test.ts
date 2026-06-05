import { describe, expect, it } from "vitest";
import {
  countActiveBoardGroups,
  getVendorOrderBoardGroupKey,
  groupVendorOrdersForBoard,
  isVendorOrderAcknowledgedForBoard,
} from "./vendor-orders-board";

describe("isVendorOrderAcknowledgedForBoard", () => {
  it("is false for sent with pending fulfillment", () => {
    expect(
      isVendorOrderAcknowledgedForBoard({
        routingStatus: "sent",
        fulfillmentStatus: "pending",
      })
    ).toBe(false);
  });

  it("is true for accepted fulfillment", () => {
    expect(
      isVendorOrderAcknowledgedForBoard({
        routingStatus: "sent",
        fulfillmentStatus: "accepted",
      })
    ).toBe(true);
  });
});

describe("getVendorOrderBoardGroupKey", () => {
  it("groups Deliverect sent + fulfillment pending as New", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "sent",
        fulfillmentStatus: "pending",
      })
    ).toBe("new");
  });

  it("groups Deliverect confirmed + fulfillment pending as New", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "pending",
      })
    ).toBe("new");
  });

  it("groups manual routing pending + fulfillment pending as New", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "pending",
        fulfillmentStatus: "pending",
      })
    ).toBe("new");
  });

  it("groups routing failure pending as New", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "failed",
        fulfillmentStatus: "pending",
      })
    ).toBe("new");
  });

  it("groups Deliverect sent + accepted as Preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "sent",
        fulfillmentStatus: "accepted",
      })
    ).toBe("preparing");
  });

  it("groups Deliverect sent + preparing as Preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "sent",
        fulfillmentStatus: "preparing",
      })
    ).toBe("preparing");
  });

  it("groups manual accepted as Preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "accepted",
      })
    ).toBe("preparing");
  });

  it("groups manual preparing as Preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "preparing",
      })
    ).toBe("preparing");
  });

  it("groups ready as Ready", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "ready",
      })
    ).toBe("ready");
  });

  it("groups completed as terminal completed", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "confirmed",
        fulfillmentStatus: "completed",
      })
    ).toBe("completed");
  });

  it("groups cancelled as terminal cancelled_failed", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "failed",
        fulfillmentStatus: "cancelled",
      })
    ).toBe("cancelled_failed");
  });

  it("groups manually recovered accepted as Preparing", () => {
    expect(
      getVendorOrderBoardGroupKey({
        routingStatus: "failed",
        fulfillmentStatus: "accepted",
        manuallyRecoveredAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe("preparing");
  });
});

describe("groupVendorOrdersForBoard", () => {
  it("counts active kitchen columns with unacknowledged in New", () => {
    const grouped = groupVendorOrdersForBoard([
      { routingStatus: "sent", fulfillmentStatus: "pending" },
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
