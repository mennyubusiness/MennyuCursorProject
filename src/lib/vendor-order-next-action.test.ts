import { describe, expect, it } from "vitest";
import { getVendorOrderKitchenActionLabel, getVendorOrderNextAction } from "./vendor-order-next-action";

describe("getVendorOrderNextAction", () => {
  it("offers accept when sent", () => {
    expect(getVendorOrderNextAction("sent", "pending", true)).toEqual({
      targetState: "accepted",
      label: "Accept order",
    });
  });

  it("offers kitchen-friendly preparing label", () => {
    expect(getVendorOrderKitchenActionLabel("confirmed", "accepted", true)).toEqual({
      targetState: "preparing",
      label: "Start preparing",
    });
  });
});
