import { describe, expect, it } from "vitest";
import { getVendorOrderKitchenActionLabel, getVendorOrderNextAction } from "./vendor-order-next-action";

describe("getVendorOrderNextAction", () => {
  it("offers accept when sent", () => {
    expect(getVendorOrderNextAction("sent", "pending", true)).toEqual({
      targetState: "accepted",
      label: "Accept order",
    });
  });

  it("offers confirm for manual vendor when routing is still pending", () => {
    expect(getVendorOrderNextAction("pending", "pending", false)).toEqual({
      targetState: "confirmed",
      label: "Confirm order",
    });
  });

  it("does not offer manual confirm for Deliverect-linked live vendor while routing pending", () => {
    expect(getVendorOrderNextAction("pending", "pending", true)).toBeNull();
  });

  it("does not offer manual accept before routing is sent or confirmed for Deliverect live vendor", () => {
    expect(getVendorOrderNextAction("pending", "pending", true)).toBeNull();
    expect(getVendorOrderNextAction("failed", "pending", true)).toBeNull();
  });

  it("offers kitchen progression for manual vendor after acceptance", () => {
    expect(getVendorOrderNextAction("confirmed", "accepted", false)).toEqual({
      targetState: "preparing",
      label: "Start preparing",
    });
    expect(getVendorOrderNextAction("confirmed", "preparing", false)).toEqual({
      targetState: "ready",
      label: "Mark ready",
    });
    expect(getVendorOrderNextAction("confirmed", "ready", false)).toEqual({
      targetState: "completed",
      label: "Mark completed",
    });
  });

  it("offers kitchen-friendly preparing label", () => {
    expect(getVendorOrderKitchenActionLabel("confirmed", "accepted", true)).toEqual({
      targetState: "preparing",
      label: "Start preparing",
    });
  });
});
