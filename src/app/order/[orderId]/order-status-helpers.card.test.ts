import { describe, expect, it } from "vitest";
import {
  customerOrderStatusCardCopy,
  resolveCustomerOrderStatusPhase,
} from "./order-status-helpers";

describe("customerOrderStatusCardCopy", () => {
  const future = new Date("2030-01-15T18:00:00.000Z");

  it("maps received / confirming states", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "routing",
      vendorOrders: [{ routingStatus: "sent", fulfillmentStatus: "pending" }],
      failedButRecoverable: false,
      requestedPickupAt: null,
    });
    expect(copy.phase).toBe("received");
    expect(copy.headline).toBe("We received your order");
    expect(copy.nextAction).toContain("confirming");
  });

  it("maps in progress", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "preparing",
      vendorOrders: [{ routingStatus: "confirmed", fulfillmentStatus: "preparing" }],
      failedButRecoverable: false,
      requestedPickupAt: null,
    });
    expect(copy.phase).toBe("in_progress");
    expect(copy.headline).toBe("Your order is being prepared");
    expect(copy.nextAction).toContain("text you");
  });

  it("maps partially ready for multi-vendor", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "in_progress",
      vendorOrders: [
        { routingStatus: "confirmed", fulfillmentStatus: "ready" },
        { routingStatus: "confirmed", fulfillmentStatus: "preparing" },
      ],
      failedButRecoverable: false,
      requestedPickupAt: null,
    });
    expect(copy.phase).toBe("partially_ready");
    expect(copy.headline).toBe("Some items are ready");
    expect(copy.nextAction).toContain("Check each vendor");
  });

  it("maps ready", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "ready",
      vendorOrders: [{ routingStatus: "confirmed", fulfillmentStatus: "ready" }],
      failedButRecoverable: false,
      requestedPickupAt: null,
    });
    expect(copy.phase).toBe("ready");
    expect(copy.nextAction).toContain("pickup code");
  });

  it("maps completed and cancelled", () => {
    expect(
      customerOrderStatusCardCopy({
        derivedStatus: "completed",
        vendorOrders: [{ routingStatus: "confirmed", fulfillmentStatus: "completed" }],
        failedButRecoverable: false,
        requestedPickupAt: null,
      }).headline
    ).toBe("Order completed");

    expect(
      customerOrderStatusCardCopy({
        derivedStatus: "cancelled",
        vendorOrders: [{ routingStatus: "confirmed", fulfillmentStatus: "cancelled" }],
        failedButRecoverable: false,
        requestedPickupAt: null,
      }).nextAction
    ).toContain("No further pickup");
  });

  it("maps failed to needs attention", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "failed",
      vendorOrders: [{ routingStatus: "failed", fulfillmentStatus: "pending" }],
      failedButRecoverable: false,
      requestedPickupAt: null,
    });
    expect(copy.phase).toBe("needs_attention");
    expect(copy.headline).toBe("Something needs attention");
  });

  it("maps recoverable failed to received", () => {
    expect(
      resolveCustomerOrderStatusPhase({
        derivedStatus: "failed",
        vendorOrders: [{ routingStatus: "failed", fulfillmentStatus: "pending" }],
        failedButRecoverable: true,
        requestedPickupAt: null,
      })
    ).toBe("received");
  });

  it("maps scheduled pickup before kitchen work", () => {
    const copy = customerOrderStatusCardCopy({
      derivedStatus: "in_progress",
      vendorOrders: [{ routingStatus: "confirmed", fulfillmentStatus: "accepted" }],
      failedButRecoverable: false,
      requestedPickupAt: future,
    });
    expect(copy.phase).toBe("scheduled");
    expect(copy.headline).toBe("Your pickup is scheduled");
  });
});
