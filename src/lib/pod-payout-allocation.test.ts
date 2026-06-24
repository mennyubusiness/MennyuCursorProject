import { describe, expect, it } from "vitest";
import {
  POD_PAYOUT_ALLOCATION_STATUS,
  POD_PAYOUT_BLOCKED_REASON,
  POD_PAYOUT_MAX_REVENUE_SHARE_BPS,
  isPodPayoutSettingsEligibleForAllocation,
  isValidPodRevenueShareBps,
  podPayoutAmountCentsFromSubtotal,
  resolvePodPayoutAllocationDecision,
} from "./pod-payout-allocation";

describe("podPayoutAmountCentsFromSubtotal", () => {
  it("computes subtotalCents × bps / 10000 with roundCents", () => {
    expect(podPayoutAmountCentsFromSubtotal(10_000, 50)).toBe(50);
    expect(podPayoutAmountCentsFromSubtotal(10_000, 350)).toBe(350);
    expect(podPayoutAmountCentsFromSubtotal(3333, 50)).toBe(17);
  });

  it("returns 0 when subtotal or bps is non-positive", () => {
    expect(podPayoutAmountCentsFromSubtotal(0, 50)).toBe(0);
    expect(podPayoutAmountCentsFromSubtotal(1000, 0)).toBe(0);
  });

  it("does not use tip, tax, service fee, or total", () => {
    const foodSubtotal = 5000;
    const amount = podPayoutAmountCentsFromSubtotal(foodSubtotal, 100);
    expect(amount).toBe(50);
    expect(amount).not.toBe(podPayoutAmountCentsFromSubtotal(foodSubtotal + 500 + 200 + 175, 100));
  });
});

describe("isValidPodRevenueShareBps", () => {
  it("allows 0 through beta max", () => {
    expect(isValidPodRevenueShareBps(0)).toBe(true);
    expect(isValidPodRevenueShareBps(50)).toBe(true);
    expect(isValidPodRevenueShareBps(POD_PAYOUT_MAX_REVENUE_SHARE_BPS)).toBe(true);
  });

  it("rejects above beta max", () => {
    expect(isValidPodRevenueShareBps(POD_PAYOUT_MAX_REVENUE_SHARE_BPS + 1)).toBe(false);
  });
});

describe("resolvePodPayoutAllocationDecision", () => {
  const enabledWithRecipient = {
    podPayoutsEnabled: true,
    podRevenueShareBps: 50,
    podPayoutRecipientUserId: "user_owner_1",
  };

  it("skips when no settings", () => {
    expect(resolvePodPayoutAllocationDecision(5000, null)).toEqual({ action: "skip" });
  });

  it("skips when settings disabled", () => {
    expect(
      resolvePodPayoutAllocationDecision(5000, {
        ...enabledWithRecipient,
        podPayoutsEnabled: false,
      })
    ).toEqual({ action: "skip" });
  });

  it("skips when bps is 0", () => {
    expect(
      resolvePodPayoutAllocationDecision(5000, {
        ...enabledWithRecipient,
        podRevenueShareBps: 0,
      })
    ).toEqual({ action: "skip" });
  });

  it("creates pending when enabled with bps and recipient", () => {
    const decision = resolvePodPayoutAllocationDecision(10_000, enabledWithRecipient);
    expect(decision).toEqual({
      action: "create",
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      blockedReason: null,
      revenueShareBps: 50,
      eligibleSubtotalCents: 10_000,
      podPayoutAmountCents: 50,
      podPayoutRecipientUserId: "user_owner_1",
    });
  });

  it("creates blocked when recipient is missing", () => {
    const decision = resolvePodPayoutAllocationDecision(10_000, {
      ...enabledWithRecipient,
      podPayoutRecipientUserId: null,
    });
    expect(decision.action).toBe("create");
    if (decision.action === "create") {
      expect(decision.status).toBe(POD_PAYOUT_ALLOCATION_STATUS.blocked);
      expect(decision.blockedReason).toBe(POD_PAYOUT_BLOCKED_REASON.missingRecipient);
      expect(decision.podPayoutAmountCents).toBe(50);
    }
  });

  it("creates blocked when subtotal is zero", () => {
    const decision = resolvePodPayoutAllocationDecision(0, enabledWithRecipient);
    expect(decision.action).toBe("create");
    if (decision.action === "create") {
      expect(decision.status).toBe(POD_PAYOUT_ALLOCATION_STATUS.blocked);
      expect(decision.blockedReason).toBe(POD_PAYOUT_BLOCKED_REASON.zeroSubtotal);
      expect(decision.podPayoutAmountCents).toBe(0);
    }
  });

  it("creates blocked when bps exceeds beta cap", () => {
    const decision = resolvePodPayoutAllocationDecision(10_000, {
      ...enabledWithRecipient,
      podRevenueShareBps: 501,
    });
    expect(decision.action).toBe("create");
    if (decision.action === "create") {
      expect(decision.status).toBe(POD_PAYOUT_ALLOCATION_STATUS.blocked);
      expect(decision.blockedReason).toBe(POD_PAYOUT_BLOCKED_REASON.invalidBps);
    }
  });

  it("snapshots configured recipient only (not other pod owners)", () => {
    const decision = resolvePodPayoutAllocationDecision(5000, {
      podPayoutsEnabled: true,
      podRevenueShareBps: 100,
      podPayoutRecipientUserId: "user_designated_payee",
    });
    expect(decision.action).toBe("create");
    if (decision.action === "create") {
      expect(decision.podPayoutRecipientUserId).toBe("user_designated_payee");
    }
  });
});

describe("isPodPayoutSettingsEligibleForAllocation", () => {
  it("requires enabled and positive bps", () => {
    expect(
      isPodPayoutSettingsEligibleForAllocation({
        podPayoutsEnabled: true,
        podRevenueShareBps: 25,
        podPayoutRecipientUserId: "u1",
      })
    ).toBe(true);
    expect(
      isPodPayoutSettingsEligibleForAllocation({
        podPayoutsEnabled: false,
        podRevenueShareBps: 25,
        podPayoutRecipientUserId: "u1",
      })
    ).toBe(false);
  });
});
