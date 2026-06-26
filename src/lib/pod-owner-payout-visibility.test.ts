import { describe, expect, it } from "vitest";

import { arePodOwnerPayoutsConfigured } from "@/lib/pod-owner-payout-visibility";

describe("arePodOwnerPayoutsConfigured", () => {
  it("returns false when admin has not enabled pod payouts", () => {
    expect(arePodOwnerPayoutsConfigured({ podPayoutsEnabled: false })).toBe(false);
  });

  it("returns true when admin has enabled pod payouts", () => {
    expect(arePodOwnerPayoutsConfigured({ podPayoutsEnabled: true })).toBe(true);
  });
});
