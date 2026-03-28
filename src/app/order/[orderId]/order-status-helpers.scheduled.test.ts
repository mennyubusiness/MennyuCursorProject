import { describe, expect, it } from "vitest";
import {
  customerStatusLabelForScheduledPickup,
  orderSummaryExplanation,
  shouldShowScheduledPickupCustomerLabels,
  vendorStatusLabelForScheduledPickup,
} from "./order-status-helpers";

describe("scheduled pickup display overrides", () => {
  const future = new Date("2030-01-15T18:00:00.000Z");

  it("parent shows Scheduled instead of In progress when only accepted/pending (future pickup)", () => {
    const vos = [{ routingStatus: "confirmed", fulfillmentStatus: "accepted" }];
    expect(
      customerStatusLabelForScheduledPickup("in_progress", vos, false, future)
    ).toBe("Scheduled");
    expect(orderSummaryExplanation("in_progress", vos, future)).toContain("scheduled");
  });

  it("parent uses normal label once any vendor is preparing", () => {
    const vos = [
      { routingStatus: "confirmed", fulfillmentStatus: "accepted" },
      { routingStatus: "confirmed", fulfillmentStatus: "preparing" },
    ];
    expect(
      customerStatusLabelForScheduledPickup("in_progress", vos, false, future)
    ).not.toBe("Scheduled");
  });

  it("ASAP orders (no requestedPickupAt) keep In progress", () => {
    const vos = [{ routingStatus: "confirmed", fulfillmentStatus: "accepted" }];
    expect(
      customerStatusLabelForScheduledPickup("in_progress", vos, false, null)
    ).toBe("In progress");
  });

  it("vendor row shows Scheduled for pending/accepted when scheduled", () => {
    expect(
      vendorStatusLabelForScheduledPickup(future, "confirmed", "accepted", false)
    ).toBe("Scheduled");
    expect(vendorStatusLabelForScheduledPickup(future, "sent", "pending", false)).toBe("Scheduled");
  });

  it("vendor row shows Preparing when kitchen is active", () => {
    expect(
      vendorStatusLabelForScheduledPickup(future, "confirmed", "preparing", false)
    ).toBe("Preparing");
  });

  it("shouldShowScheduledPickupCustomerLabels is false when any vendor is ready", () => {
    expect(
      shouldShowScheduledPickupCustomerLabels(future, [
        { fulfillmentStatus: "accepted" },
        { fulfillmentStatus: "ready" },
      ])
    ).toBe(false);
  });

  it("vendor row: terminal and active states override Scheduled", () => {
    expect(vendorStatusLabelForScheduledPickup(future, "confirmed", "cancelled", false)).toBe(
      "Cancelled"
    );
    expect(vendorStatusLabelForScheduledPickup(future, "confirmed", "ready", false)).toBe(
      "Ready for pickup"
    );
    expect(vendorStatusLabelForScheduledPickup(future, "failed", "pending", false)).toBe(
      "Unavailable"
    );
  });

  it("ASAP order: vendor accepted shows Accepted, not Scheduled", () => {
    expect(vendorStatusLabelForScheduledPickup(null, "confirmed", "accepted", false)).toBe(
      "Accepted"
    );
  });
});
