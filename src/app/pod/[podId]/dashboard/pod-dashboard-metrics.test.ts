import { describe, expect, it } from "vitest";

import { podDashboardHasOrderActivity } from "./PodDashboardMetrics";

describe("podDashboardHasOrderActivity", () => {
  it("is false when there are no orders today or in the last 7 days", () => {
    expect(
      podDashboardHasOrderActivity({
        activeVendors: 2,
        ordersToday: 0,
        ordersLast7: 0,
        grossSalesTodayCents: 0,
        grossSalesLast7Cents: 0,
        avgOrderValueCents: 0,
      })
    ).toBe(false);
  });

  it("is true when there is at least one recent order", () => {
    expect(
      podDashboardHasOrderActivity({
        activeVendors: 2,
        ordersToday: 0,
        ordersLast7: 3,
        grossSalesTodayCents: 0,
        grossSalesLast7Cents: 4500,
        avgOrderValueCents: 1500,
      })
    ).toBe(true);
  });
});
