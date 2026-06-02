import { describe, expect, it } from "vitest";
import { evaluateSimulateRoutingFailureEligibility } from "./admin-simulate-routing-failure";

describe("evaluateSimulateRoutingFailureEligibility", () => {
  it("allows paid order with pending fulfillment", () => {
    expect(
      evaluateSimulateRoutingFailureEligibility({
        orderStatus: "paid",
        fulfillmentStatus: "pending",
      }).eligible
    ).toBe(true);
  });

  it("blocks unpaid order", () => {
    const result = evaluateSimulateRoutingFailureEligibility({
      orderStatus: "pending_payment",
      fulfillmentStatus: "pending",
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.code).toBe("ORDER_UNPAID");
  });

  it("blocks terminal fulfillment states", () => {
    for (const fulfillmentStatus of ["completed", "cancelled", "ready"] as const) {
      const result = evaluateSimulateRoutingFailureEligibility({
        orderStatus: "paid",
        fulfillmentStatus,
      });
      expect(result.eligible).toBe(false);
      if (!result.eligible) expect(result.code).toBe("TERMINAL_FULFILLMENT");
    }
  });

  it("blocks non-pending in-progress fulfillment", () => {
    const result = evaluateSimulateRoutingFailureEligibility({
      orderStatus: "routing",
      fulfillmentStatus: "accepted",
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.code).toBe("FULFILLMENT_NOT_PENDING");
  });
});
