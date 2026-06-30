import { describe, expect, it } from "vitest";
import {
  isDeliverectDashboardGraceApplicable,
  shouldOmitVendorOrderFromDeliverectDashboard,
} from "./vendor-deliverect-dashboard-visibility";

const pendingVo = {
  routingStatus: "pending",
  fulfillmentStatus: "pending",
  deliverectAttempts: 0,
  order: { updatedAt: new Date() },
};

describe("vendor-deliverect-dashboard-visibility", () => {
  it("never applies grace-hide to manual_dashboard vendors", () => {
    const vendor = {
      deliverectChannelLinkId: "ch_1",
      orderRoutingMode: "manual_dashboard" as const,
    };
    expect(isDeliverectDashboardGraceApplicable(vendor, true)).toBe(false);
    expect(
      shouldOmitVendorOrderFromDeliverectDashboard(pendingVo, vendor, true, Date.now())
    ).toBe(false);
  });

  it("still omits pending orders for deliverect vendors during grace window", () => {
    const vendor = {
      deliverectChannelLinkId: "ch_1",
      orderRoutingMode: "deliverect" as const,
    };
    expect(isDeliverectDashboardGraceApplicable(vendor, true)).toBe(true);
    expect(
      shouldOmitVendorOrderFromDeliverectDashboard(pendingVo, vendor, true, Date.now())
    ).toBe(true);
  });
});
