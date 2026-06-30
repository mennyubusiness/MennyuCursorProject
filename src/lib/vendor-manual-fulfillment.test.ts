import { describe, expect, it } from "vitest";
import {
  getVendorKitchenSkipAheadActions,
  isVendorDashboardTransitionNoOp,
  resolveVendorDashboardTransitionPatch,
} from "./vendor-manual-fulfillment";

describe("resolveVendorDashboardTransitionPatch", () => {
  it("uses strict step-by-step when skip-ahead is disabled", () => {
    expect(
      resolveVendorDashboardTransitionPatch("confirmed", "pending", "ready", {
        allowSkipAhead: false,
      }).error
    ).toMatch(/Only preparing can transition to ready/);
  });

  it("allows pending → accepted with routing confirm when skip-ahead enabled", () => {
    const { patch, error } = resolveVendorDashboardTransitionPatch(
      "pending",
      "pending",
      "accepted",
      { allowSkipAhead: true }
    );
    expect(error).toBeNull();
    expect(patch).toEqual({ routingStatus: "confirmed", fulfillmentStatus: "accepted" });
  });

  it("allows skip from new to preparing", () => {
    const { patch, error } = resolveVendorDashboardTransitionPatch(
      "pending",
      "pending",
      "preparing",
      { allowSkipAhead: true }
    );
    expect(error).toBeNull();
    expect(patch).toEqual({ routingStatus: "confirmed", fulfillmentStatus: "preparing" });
  });

  it("allows skip from new to ready", () => {
    const { patch, error } = resolveVendorDashboardTransitionPatch(
      "confirmed",
      "pending",
      "ready",
      { allowSkipAhead: true }
    );
    expect(error).toBeNull();
    expect(patch).toEqual({ fulfillmentStatus: "ready" });
  });

  it("allows skip from accepted to ready", () => {
    const { patch, error } = resolveVendorDashboardTransitionPatch(
      "confirmed",
      "accepted",
      "ready",
      { allowSkipAhead: true }
    );
    expect(error).toBeNull();
    expect(patch).toEqual({ fulfillmentStatus: "ready" });
  });

  it("allows skip from preparing to completed", () => {
    const { patch, error } = resolveVendorDashboardTransitionPatch(
      "confirmed",
      "preparing",
      "completed",
      { allowSkipAhead: true }
    );
    expect(error).toBeNull();
    expect(patch).toEqual({ fulfillmentStatus: "completed" });
  });

  it("rejects backwards transitions", () => {
    expect(
      resolveVendorDashboardTransitionPatch("confirmed", "ready", "preparing", {
        allowSkipAhead: true,
      }).error
    ).not.toBeNull();
  });

  it("is idempotent when already at target fulfillment", () => {
    expect(
      resolveVendorDashboardTransitionPatch("confirmed", "preparing", "preparing", {
        allowSkipAhead: true,
      })
    ).toEqual({ patch: {}, error: null });
    expect(
      isVendorDashboardTransitionNoOp("confirmed", "preparing", {})
    ).toBe(true);
  });
});

describe("getVendorKitchenSkipAheadActions", () => {
  it("offers skip actions for new orders but not duplicate of primary", () => {
    const actions = getVendorKitchenSkipAheadActions("confirmed", "pending", "accepted");
    expect(actions.map((a) => a.targetState)).toEqual(["preparing", "ready"]);
  });

  it("offers complete-without-ready from preparing", () => {
    const actions = getVendorKitchenSkipAheadActions("confirmed", "preparing", "ready");
    expect(actions).toEqual([
      { targetState: "completed", label: "Complete without ready step" },
    ]);
  });
});
