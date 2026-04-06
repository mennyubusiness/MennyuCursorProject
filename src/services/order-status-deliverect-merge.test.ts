import { describe, expect, it } from "vitest";
import { mergeDeliverectMappedIntoVendorOrder } from "./order-status.service";

describe("mergeDeliverectMappedIntoVendorOrder", () => {
  it("monotonic increase: accepted then preparing", () => {
    const r = mergeDeliverectMappedIntoVendorOrder(
      { routingStatus: "confirmed", fulfillmentStatus: "accepted" },
      { routingStatus: "confirmed", fulfillmentStatus: "preparing" }
    );
    expect(r.nextFulfillment).toBe("preparing");
    expect(r.nextRouting).toBe("confirmed");
  });

  it("does not downgrade fulfillment when mapped is lower rank", () => {
    const r = mergeDeliverectMappedIntoVendorOrder(
      { routingStatus: "confirmed", fulfillmentStatus: "ready" },
      { routingStatus: "confirmed", fulfillmentStatus: "accepted" }
    );
    expect(r.nextFulfillment).toBe("ready");
  });

  it("maps POS failure to routing failed when not completed", () => {
    const r = mergeDeliverectMappedIntoVendorOrder(
      { routingStatus: "sent", fulfillmentStatus: "pending" },
      { routingStatus: "failed", fulfillmentStatus: "pending" }
    );
    expect(r.nextRouting).toBe("failed");
  });
});
