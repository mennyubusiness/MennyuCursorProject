import { describe, expect, it } from "vitest";
import {
  vendorOrderHeadlineStatus,
  vendorRoutingStatusLabel,
  vendorFulfillmentStatusLabel,
} from "./vendor-order-vendor-display";

describe("vendorOrderHeadlineStatus", () => {
  it("uses plain English for common states", () => {
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "sent", fulfillmentStatus: "pending", needsAttention: false })
    ).toBe("Sent to POS");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "pending", fulfillmentStatus: "pending", needsAttention: false })
    ).toBe("Waiting for POS confirmation");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "failed", fulfillmentStatus: "pending", needsAttention: false })
    ).toBe("Could not send to POS");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "confirmed", fulfillmentStatus: "preparing", needsAttention: false })
    ).toBe("Preparing");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "confirmed", fulfillmentStatus: "ready", needsAttention: false })
    ).toBe("Ready for pickup");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "confirmed", fulfillmentStatus: "completed", needsAttention: false })
    ).toBe("Completed");
    expect(
      vendorOrderHeadlineStatus({ routingStatus: "sent", fulfillmentStatus: "pending", needsAttention: true })
    ).toBe("Needs attention");
  });
});

describe("vendorRoutingStatusLabel", () => {
  it("does not expose raw routing status strings", () => {
    expect(vendorRoutingStatusLabel("sent", "pending")).toBe("Sent to POS");
    expect(vendorRoutingStatusLabel("failed", "pending")).toBe("Could not send to POS");
  });
});

describe("vendorFulfillmentStatusLabel", () => {
  it("maps fulfillment to vendor-friendly labels", () => {
    expect(vendorFulfillmentStatusLabel("ready")).toBe("Ready for pickup");
    expect(vendorFulfillmentStatusLabel("preparing")).toBe("Preparing");
  });
});
