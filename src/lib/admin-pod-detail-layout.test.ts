import { describe, expect, it } from "vitest";
import { deriveAdminPodDetailLayout, adminPodReadinessLabel } from "./admin-pod-detail-layout";

const emptyAllocationSummary = {
  pending: { count: 0, amountCents: 0 },
  blocked: { count: 0, amountCents: 0 },
  cancelledDueToRefund: { count: 0, amountCents: 0 },
  blockedPartialRefundReview: { count: 0, amountCents: 0 },
  other: { count: 0, amountCents: 0 },
  total: { count: 0, amountCents: 0 },
};

const emptyTransferSummary = {
  pendingAllocationAmountCents: 0,
  pendingAllocationCount: 0,
  transferableAmountCents: 0,
  transferableCount: 0,
  blockedTransferAmountCents: 0,
  blockedTransferCount: 0,
  paidTransferAmountCents: 0,
  paidTransferCount: 0,
  minimumPayoutCents: 1000,
};

describe("adminPodReadinessLabel", () => {
  it("maps internal onboarding statuses to admin labels", () => {
    expect(adminPodReadinessLabel("ready_for_next_step", true)).toBe("Ready");
    expect(adminPodReadinessLabel("profile_incomplete", true)).toBe("Setup needed");
    expect(adminPodReadinessLabel("ready_for_next_step", false)).toBe("Inactive");
  });
});

describe("deriveAdminPodDetailLayout", () => {
  it("opens payout details by default when there are payout issues", () => {
    const layout = deriveAdminPodDetailLayout({
      podPayoutsEnabled: true,
      podPayoutRecipientUserId: "user_1",
      recipientConnectStatus: { ready: false, adminLabel: "Not started", ownerLabel: "Not started" },
      allocationSummary: emptyAllocationSummary,
      transferSummary: emptyTransferSummary,
      allocationCount: 0,
      transferCount: 0,
      failedTransferCount: 0,
    });

    expect(layout.hasPayoutIssues).toBe(true);
    expect(layout.shouldShowFullPayoutDetailsByDefault).toBe(true);
    expect(layout.shouldShowRunPayoutBatch).toBe(false);
  });

  it("allows run payout batch only when transferable amount meets minimum", () => {
    const layout = deriveAdminPodDetailLayout({
      podPayoutsEnabled: true,
      podPayoutRecipientUserId: "user_1",
      recipientConnectStatus: { ready: true, adminLabel: "Ready", ownerLabel: "Ready" },
      allocationSummary: emptyAllocationSummary,
      transferSummary: {
        ...emptyTransferSummary,
        transferableAmountCents: 1500,
        transferableCount: 2,
        minimumPayoutCents: 1000,
      },
      allocationCount: 2,
      transferCount: 2,
      failedTransferCount: 0,
    });

    expect(layout.hasTransferablePodPayout).toBe(true);
    expect(layout.shouldShowRunPayoutBatch).toBe(true);
    expect(layout.shouldShowTransferTable).toBe(true);
  });
});
