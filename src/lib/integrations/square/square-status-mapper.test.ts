import { describe, expect, it } from "vitest";

import {
  mapSquareOrderSnapshotToVendorStatus,
  mergeSquareMappedIntoVendorOrder,
  pickSquarePickupFulfillment,
} from "@/lib/integrations/square/square-status-mapper";
import type { SquareOrderSnapshot } from "@/lib/integrations/square/square-order.types";

describe("mapSquareOrderSnapshotToVendorStatus", () => {
  it("maps PREPARED pickup fulfillment to ready", () => {
    const mapped = mapSquareOrderSnapshotToVendorStatus({
      id: "sq_1",
      state: "OPEN",
      fulfillments: [{ type: "PICKUP", state: "PREPARED" }],
    });
    expect(mapped?.fulfillmentStatus).toBe("ready");
    expect(mapped?.routingStatus).toBe("confirmed");
  });

  it("maps COMPLETED fulfillment to completed", () => {
    const mapped = mapSquareOrderSnapshotToVendorStatus({
      id: "sq_1",
      fulfillments: [{ type: "PICKUP", state: "COMPLETED" }],
    });
    expect(mapped?.fulfillmentStatus).toBe("completed");
  });

  it("maps CANCELED fulfillment to cancelled", () => {
    const mapped = mapSquareOrderSnapshotToVendorStatus({
      id: "sq_1",
      fulfillments: [{ type: "PICKUP", state: "CANCELED" }],
    });
    expect(mapped?.fulfillmentStatus).toBe("cancelled");
  });

  it("maps RESERVED to preparing", () => {
    const mapped = mapSquareOrderSnapshotToVendorStatus({
      id: "sq_1",
      fulfillments: [{ type: "PICKUP", state: "RESERVED" }],
    });
    expect(mapped?.fulfillmentStatus).toBe("preparing");
  });
});

describe("mergeSquareMappedIntoVendorOrder", () => {
  it("does not regress completed to preparing", () => {
    const merged = mergeSquareMappedIntoVendorOrder(
      { routingStatus: "confirmed", fulfillmentStatus: "completed" },
      { fulfillmentStatus: "preparing", routingStatus: "confirmed" }
    );
    expect(merged.nextFulfillment).toBe("completed");
  });

  it("does not regress ready to accepted", () => {
    const merged = mergeSquareMappedIntoVendorOrder(
      { routingStatus: "confirmed", fulfillmentStatus: "ready" },
      { fulfillmentStatus: "accepted", routingStatus: "confirmed" }
    );
    expect(merged.nextFulfillment).toBe("ready");
  });

  it("promotes sent routing to confirmed on Square progress", () => {
    const merged = mergeSquareMappedIntoVendorOrder(
      { routingStatus: "sent", fulfillmentStatus: "pending" },
      { fulfillmentStatus: "accepted", routingStatus: "confirmed" }
    );
    expect(merged.nextRouting).toBe("confirmed");
    expect(merged.nextFulfillment).toBe("accepted");
  });
});

describe("pickSquarePickupFulfillment", () => {
  it("prefers most advanced pickup fulfillment", () => {
    const picked = pickSquarePickupFulfillment([
      { type: "PICKUP", state: "PROPOSED" },
      { type: "PICKUP", state: "PREPARED" },
    ]);
    expect(picked?.state).toBe("PREPARED");
  });
});
