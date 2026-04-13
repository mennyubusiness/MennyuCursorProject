import { describe, expect, it } from "vitest";
import { deriveParentStatusFromChildren, type ChildOrderState } from "./order-state";

const confirmed = (fulfillment: ChildOrderState["fulfillmentStatus"]): ChildOrderState => ({
  routingStatus: "confirmed",
  fulfillmentStatus: fulfillment,
});

describe("deriveParentStatusFromChildren (multi-vendor parent)", () => {
  it("returns completed when some vendor orders completed and others cancelled", () => {
    expect(deriveParentStatusFromChildren([confirmed("completed"), confirmed("cancelled")])).toBe(
      "completed"
    );
    expect(
      deriveParentStatusFromChildren([
        confirmed("completed"),
        confirmed("completed"),
        confirmed("cancelled"),
      ])
    ).toBe("completed");
  });

  it("returns cancelled when all vendor orders are cancelled", () => {
    expect(deriveParentStatusFromChildren([confirmed("cancelled"), confirmed("cancelled")])).toBe(
      "cancelled"
    );
  });

  it("still returns partially_completed when completed mixes with routing-failed (non-terminal) vendor", () => {
    const completed: ChildOrderState = { routingStatus: "confirmed", fulfillmentStatus: "completed" };
    const failedRouting: ChildOrderState = { routingStatus: "failed", fulfillmentStatus: "pending" };
    expect(deriveParentStatusFromChildren([completed, failedRouting])).toBe("partially_completed");
  });
});
