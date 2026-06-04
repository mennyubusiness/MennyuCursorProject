import { describe, expect, it } from "vitest";
import { buildAdminOrderTimeline } from "./admin-order-timeline";
import type { AdminOrderDetail } from "./admin-order-detail-query";

describe("buildAdminOrderTimeline group order", () => {
  it("includes group lifecycle entries when session is linked", () => {
    const detail = {
      id: "ord_1",
      createdAt: new Date("2026-06-04T12:05:00Z"),
      groupOrderSessionId: "gos_1",
      groupOrderSession: {
        id: "gos_1",
        joinCode: "654321",
        status: "submitted",
        lockedAt: new Date("2026-06-04T12:02:00Z"),
        createdAt: new Date("2026-06-04T11:00:00Z"),
      },
      statusHistory: [],
      vendorOrders: [],
      issues: [],
      refundAttempts: [],
    } as unknown as AdminOrderDetail;

    const timeline = buildAdminOrderTimeline(detail);
    const titles = timeline.map((e) => e.title);
    expect(titles.some((t) => t.includes("Group order started"))).toBe(true);
    expect(titles.some((t) => t.includes("Host started checkout"))).toBe(true);
    expect(titles.some((t) => t.includes("Group order submitted"))).toBe(true);
  });
});
