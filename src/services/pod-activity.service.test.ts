import { describe, expect, it } from "vitest";

import {
  assemblePodActivityFeed,
  buildCurrentStatusActivityItems,
  buildTimestampedPodActivityItems,
  buildVendorLiveActivityMessage,
  isPodActivityMessageSafe,
  vendorNeedsSetupActivityMessage,
} from "./pod-activity.service";

describe("vendor activity copy", () => {
  it("uses friendly live and needs-setup labels", () => {
    expect(buildVendorLiveActivityMessage("Billy's Jams")).toBe(
      "Billy's Jams is now live on your pod page."
    );
    expect(vendorNeedsSetupActivityMessage("Happy Burger", "Needs Stripe")).toBe(
      "Happy Burger still needs Stripe setup before customers can order."
    );
  });

  it("does not include fake financial or customer data in messages", () => {
    const messages = [
      buildVendorLiveActivityMessage("Taco Lab"),
      vendorNeedsSetupActivityMessage("Taco Lab", "Needs menu"),
      "A group order was placed at your pod.",
      "12 Open Order orders were placed at your pod today.",
    ];
    for (const message of messages) {
      expect(isPodActivityMessageSafe(message)).toBe(true);
    }
  });
});

describe("buildTimestampedPodActivityItems", () => {
  it("summarizes multiple orders today into one pod-level item", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const items = buildTimestampedPodActivityItems({
      membershipInvites: [],
      membershipAccepted: [],
      vendorJoins: [],
      recentOrders: [
        { id: "o1", createdAt: today, groupOrderSessionId: null },
        { id: "o2", createdAt: today, groupOrderSessionId: null },
      ],
      ordersToday: 12,
      latestOrderTodayAt: today,
    });

    expect(items.some((item) => item.message === "12 Open Order orders were placed at your pod today.")).toBe(
      true
    );
    expect(items.filter((item) => item.kind === "order_placed")).toHaveLength(0);
  });

  it("includes membership invite and join events", () => {
    const at = new Date("2026-06-01T15:00:00.000Z");
    const items = buildTimestampedPodActivityItems({
      membershipInvites: [{ id: "req1", vendorName: "Happy Burger", createdAt: at }],
      membershipAccepted: [
        {
          id: "req2",
          vendorId: "v1",
          vendorName: "Billy's Jams",
          respondedAt: new Date("2026-06-02T15:00:00.000Z"),
        },
      ],
      vendorJoins: [],
      recentOrders: [],
      ordersToday: 0,
      latestOrderTodayAt: null,
    });

    expect(items.map((item) => item.message)).toEqual(
      expect.arrayContaining([
        "You invited Happy Burger to join your pod.",
        "Billy's Jams joined your pod.",
      ])
    );
  });
});

describe("buildCurrentStatusActivityItems", () => {
  it("surfaces vendors needing setup ahead of live vendors", () => {
    const items = buildCurrentStatusActivityItems([
      {
        vendorId: "v-live",
        name: "Live Cart",
        podVendorActive: true,
        vendorGloballyActive: true,
        readiness: { status: "active", canAcceptOrders: true },
      },
      {
        vendorId: "v-needs",
        name: "Stripe Cart",
        podVendorActive: true,
        vendorGloballyActive: true,
        readiness: { status: "needs_payment", canAcceptOrders: false },
      },
    ]);

    expect(items[0]?.message).toContain("Stripe Cart still needs Stripe setup");
    expect(items.some((item) => item.message.includes("Live Cart is now live"))).toBe(true);
  });
});

describe("assemblePodActivityFeed", () => {
  it("returns empty feed when there are no items", () => {
    const feed = assemblePodActivityFeed([], []);
    expect(feed.isEmpty).toBe(true);
    expect(feed.recent).toHaveLength(0);
    expect(feed.currentStatus).toHaveLength(0);
  });

  it("limits total visible items", () => {
    const recent = Array.from({ length: 10 }, (_, index) => ({
      id: `recent-${index}`,
      kind: "order_placed" as const,
      message: "An Open Order was placed at your pod.",
      occurredAt: new Date(),
      section: "recent" as const,
    }));
    const currentStatus = Array.from({ length: 5 }, (_, index) => ({
      id: `status-${index}`,
      kind: "vendor_live" as const,
      message: `Vendor ${index} is now live on your pod page.`,
      occurredAt: null,
      section: "current_status" as const,
    }));

    const feed = assemblePodActivityFeed(recent, currentStatus);
    expect(feed.recent).toHaveLength(6);
    expect(feed.recent.length + feed.currentStatus.length).toBeLessThanOrEqual(8);
    expect(feed.isEmpty).toBe(false);
  });
});

describe("privacy guards", () => {
  it("rejects messages with revenue or contact patterns", () => {
    expect(isPodActivityMessageSafe("Customer paid $12.50")).toBe(false);
    expect(isPodActivityMessageSafe("Contact vendor@example.com")).toBe(false);
    expect(isPodActivityMessageSafe("Vendor payout pending")).toBe(false);
  });
});
