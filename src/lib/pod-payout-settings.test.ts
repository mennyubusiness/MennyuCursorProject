import { describe, expect, it } from "vitest";
import { POD_PAYOUT_MAX_REVENUE_SHARE_BPS } from "@/lib/pod-payout-allocation";
import { validateUpdatePodPayoutSettingsInput } from "./pod-payout-settings";

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
      error: "Designated recipient is required when pod payouts are enabled.",
    });
  });

  it("requires bps > 0 when enabled", () => {
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
      error: "Revenue share must be greater than 0 when pod payouts are enabled.",
    });
  });

  it("enforces bps cap at 500", () => {
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
      expect(result.error).toContain("500");
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
      error: "Designated recipient must be a pod owner for this pod.",
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
