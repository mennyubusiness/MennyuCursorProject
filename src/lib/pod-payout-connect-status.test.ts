import { describe, expect, it } from "vitest";
import { derivePodPayoutConnectStatus } from "./pod-payout-connect-status";

describe("derivePodPayoutConnectStatus", () => {
  it("returns not_started when no account id", () => {
    const status = derivePodPayoutConnectStatus({
      podPayoutStripeConnectedAccountId: null,
      podPayoutStripeChargesEnabled: false,
      podPayoutStripePayoutsEnabled: false,
      podPayoutStripeRequirementsCurrentlyDue: null,
    });
    expect(status.code).toBe("not_started");
    expect(status.ready).toBe(false);
  });

  it("returns ready when charges and payouts enabled", () => {
    const status = derivePodPayoutConnectStatus({
      podPayoutStripeConnectedAccountId: "acct_pod_1",
      podPayoutStripeChargesEnabled: true,
      podPayoutStripePayoutsEnabled: true,
      podPayoutStripeRequirementsCurrentlyDue: [],
    });
    expect(status.code).toBe("ready");
    expect(status.adminLabel).toBe("Ready");
    expect(status.ownerLabel).toBe("Payout setup complete");
  });

  it("returns needs_attention when requirements are due", () => {
    const status = derivePodPayoutConnectStatus({
      podPayoutStripeConnectedAccountId: "acct_pod_1",
      podPayoutStripeChargesEnabled: false,
      podPayoutStripePayoutsEnabled: false,
      podPayoutStripeRequirementsCurrentlyDue: ["individual.verification.document"],
    });
    expect(status.code).toBe("needs_attention");
    expect(status.requirementsPendingCount).toBe(1);
  });

  it("returns onboarding_incomplete when account exists but not ready", () => {
    const status = derivePodPayoutConnectStatus({
      podPayoutStripeConnectedAccountId: "acct_pod_1",
      podPayoutStripeChargesEnabled: true,
      podPayoutStripePayoutsEnabled: false,
      podPayoutStripeRequirementsCurrentlyDue: [],
    });
    expect(status.code).toBe("onboarding_incomplete");
  });
});
