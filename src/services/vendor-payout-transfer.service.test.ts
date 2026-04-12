import { describe, expect, it } from "vitest";
import {
  blockedReasonForVendor,
  isVendorConnectPayoutReady,
} from "./vendor-payout-transfer.service";

describe("vendor connect payout readiness", () => {
  it("is ready only with account id, charges, and payouts enabled", () => {
    expect(
      isVendorConnectPayoutReady({
        stripeConnectedAccountId: "acct_123",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      })
    ).toBe(true);
    expect(
      isVendorConnectPayoutReady({
        stripeConnectedAccountId: null,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      })
    ).toBe(false);
    expect(
      isVendorConnectPayoutReady({
        stripeConnectedAccountId: "acct_123",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: true,
      })
    ).toBe(false);
  });

  it("blockedReason explains missing pieces", () => {
    expect(
      blockedReasonForVendor({
        stripeConnectedAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      })
    ).toBe("stripe_connect_account_missing");
  });
});
