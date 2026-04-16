import { describe, expect, it } from "vitest";
import { buildParentOrderProgressSteps } from "./customer-order-progress";

describe("buildParentOrderProgressSteps", () => {
  it("keeps parent on Received when all vendors are still pending (in_progress)", () => {
    const steps = buildParentOrderProgressSteps("in_progress", false, [
      { fulfillmentStatus: "pending", routingStatus: "confirmed" },
    ]);
    const received = steps.find((s) => s.key === "received");
    const confirmed = steps.find((s) => s.key === "confirm");
    expect(received?.state).toBe("current");
    expect(confirmed?.state).toBe("upcoming");
  });

  it("uses Received for routing/paid when fulfillment max is still pending (not Confirming)", () => {
    const steps = buildParentOrderProgressSteps("routing", false, [
      { fulfillmentStatus: "pending", routingStatus: "sent" },
    ]);
    expect(steps.find((s) => s.key === "received")?.state).toBe("current");
    expect(steps.find((s) => s.key === "confirm")?.shortLabel).toBe("Confirmed");
    expect(steps.find((s) => s.key === "confirm")?.state).toBe("upcoming");
  });

  it("moves parent to Confirmed current when at least one vendor is accepted", () => {
    const steps = buildParentOrderProgressSteps("in_progress", false, [
      { fulfillmentStatus: "accepted", routingStatus: "confirmed" },
    ]);
    expect(steps.find((s) => s.key === "received")?.state).toBe("complete");
    expect(steps.find((s) => s.key === "confirm")?.state).toBe("current");
  });
});
