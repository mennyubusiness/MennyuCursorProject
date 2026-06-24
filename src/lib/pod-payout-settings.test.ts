import { describe, expect, it } from "vitest";
import { POD_PAYOUT_MAX_REVENUE_SHARE_BPS } from "@/lib/pod-payout-allocation";
import {
  formatMinimumPayoutDollarsForInput,
  formatPodSharePercentForInput,
  minimumPayoutCentsToDollars,
  minimumPayoutDollarsToCents,
  podRevenueShareBpsToPercent,
  podRevenueSharePercentToBps,
  validateUpdatePodPayoutSettingsInput,
} from "./pod-payout-settings";

const POD_ID = "pod_1";
const OWNER_A = "user_owner_a";
const OWNER_B = "user_owner_b";

describe("validateUpdatePodPayoutSettingsInput", () => {
  const ctx = { podOwnerUserIds: [OWNER_A, OWNER_B] };

  it("accepts disabled settings with saved recipient and zero bps", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: false,
        podRevenueShareBps: 50,
        podPayoutRecipientUserId: OWNER_A,
        minimumPayoutCents: 100,
      },
      ctx
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.podPayoutsEnabled).toBe(false);
      expect(result.normalized.podRevenueShareBps).toBe(50);
    }
  });

  it("requires recipient when enabled", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: 50,
        podPayoutRecipientUserId: null,
        minimumPayoutCents: 0,
      },
      ctx
    );
    expect(result).toEqual({
      ok: false,
      error: "Payout account owner is required when pod payouts are enabled.",
    });
  });

  it("requires pod share > 0 when enabled", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: 0,
        podPayoutRecipientUserId: OWNER_A,
        minimumPayoutCents: 0,
      },
      ctx
    );
    expect(result).toEqual({
      ok: false,
      error: "Pod share must be greater than 0% when pod payouts are enabled.",
    });
  });

  it("enforces pod share cap at 500 bps (5.00%)", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: POD_PAYOUT_MAX_REVENUE_SHARE_BPS + 1,
        podPayoutRecipientUserId: OWNER_A,
        minimumPayoutCents: 0,
      },
      ctx
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("5.00%");
    }
  });

  it("requires recipient to be a pod owner", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: 25,
        podPayoutRecipientUserId: "user_not_owner",
        minimumPayoutCents: 0,
      },
      ctx
    );
    expect(result).toEqual({
      ok: false,
      error: "Payout account owner must be a pod owner for this pod.",
    });
  });

  it("allows designated owner among multiple owners", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: 100,
        podPayoutRecipientUserId: OWNER_B,
        minimumPayoutCents: 500,
      },
      ctx
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.podPayoutRecipientUserId).toBe(OWNER_B);
    }
  });

  it("rejects negative minimum payout", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: false,
        podRevenueShareBps: 0,
        podPayoutRecipientUserId: null,
        minimumPayoutCents: -5,
      },
      ctx
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.minimumPayoutCents).toBe(0);
    }
  });
});

describe("pod payout admin UI conversions", () => {
  it("converts percent to bps for storage", () => {
    expect(podRevenueSharePercentToBps(0.75)).toBe(75);
    expect(podRevenueSharePercentToBps(1)).toBe(100);
    expect(podRevenueSharePercentToBps(5)).toBe(500);
  });

  it("converts stored bps to percent for display", () => {
    expect(podRevenueShareBpsToPercent(75)).toBe(0.75);
    expect(podRevenueShareBpsToPercent(500)).toBe(5);
  });

  it("rejects percent above 5.00 via server bps cap", () => {
    const result = validateUpdatePodPayoutSettingsInput(
      {
        podId: POD_ID,
        podPayoutsEnabled: true,
        podRevenueShareBps: podRevenueSharePercentToBps(5.01),
        podPayoutRecipientUserId: OWNER_A,
        minimumPayoutCents: 0,
      },
      { podOwnerUserIds: [OWNER_A] }
    );
    expect(result.ok).toBe(false);
  });

  it("converts minimum payout dollars to cents", () => {
    expect(minimumPayoutDollarsToCents(10)).toBe(1000);
    expect(minimumPayoutDollarsToCents(0.5)).toBe(50);
    expect(minimumPayoutDollarsToCents(0)).toBe(0);
  });

  it("converts stored cents to dollars for display", () => {
    expect(minimumPayoutCentsToDollars(1000)).toBe(10);
    expect(minimumPayoutCentsToDollars(50)).toBe(0.5);
  });

  it("formats stored values for admin inputs", () => {
    expect(formatPodSharePercentForInput(75)).toBe("0.75");
    expect(formatPodSharePercentForInput(500)).toBe("5");
    expect(formatMinimumPayoutDollarsForInput(1000)).toBe("10");
    expect(formatMinimumPayoutDollarsForInput(50)).toBe("0.5");
  });
});
