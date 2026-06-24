import { describe, expect, it } from "vitest";
import {
  countActionItems,
  countRetryableTransfers,
  isRecentlySentTransfer,
  reversalIsRecoveredHistory,
  reversalNeedsAction,
  transferFundingBadgeLabel,
  transferFundingKind,
  transferNeedsAction,
  transferProblemLabel,
  transferStatusShortLabel,
} from "./admin-payout-transfers-ux";

const baseTransfer = {
  id: "t1",
  status: "paid",
  amountCents: 1000,
  createdAt: "2026-06-01T00:00:00.000Z",
  submittedAt: "2026-06-01T01:00:00.000Z",
  stripeTransferId: "tr_123",
  destinationAccountId: "acct_1",
  blockedReason: null,
  failureMessage: null,
  clawbackBadge: null as const,
};

describe("admin-payout-transfers-ux", () => {
  it("paid transfer without clawback is recently sent not needs action", () => {
    expect(transferNeedsAction(baseTransfer)).toBe(false);
    expect(isRecentlySentTransfer(baseTransfer)).toBe(true);
  });

  it("clawback missing is needs action not recently sent", () => {
    const row = { ...baseTransfer, clawbackBadge: "missing" as const };
    expect(transferNeedsAction(row)).toBe(true);
    expect(isRecentlySentTransfer(row)).toBe(false);
  });

  it("clawback recovered is not needs action", () => {
    const row = { ...baseTransfer, clawbackBadge: "recovered" as const };
    expect(transferNeedsAction(row)).toBe(false);
    expect(isRecentlySentTransfer(row)).toBe(true);
  });

  it("ready pending transfer needs action", () => {
    const row = { ...baseTransfer, status: "pending", stripeTransferId: null };
    expect(transferNeedsAction(row)).toBe(true);
    expect(isRecentlySentTransfer(row)).toBe(false);
  });

  it("cancelled due to refund is not needs action", () => {
    const row = { ...baseTransfer, status: "cancelled_due_to_refund", stripeTransferId: null };
    expect(transferNeedsAction(row)).toBe(false);
  });

  it("reversal pending needs action; reversed is history", () => {
    const rev = { id: "r1", status: "pending", amountCents: 500, createdAt: "2026-06-01" };
    expect(reversalNeedsAction(rev)).toBe(true);
    expect(reversalIsRecoveredHistory({ ...rev, status: "reversed" })).toBe(true);
  });

  it("counts action items across transfers and reversals", () => {
    expect(
      countActionItems(
        [{ ...baseTransfer, status: "pending", stripeTransferId: null }],
        [{ id: "r1", status: "failed", amountCents: 1, createdAt: "" }]
      )
    ).toBe(2);
  });

  it("manual-review badge needs action until reviewed", () => {
    const row = {
      id: "t1",
      status: "paid",
      amountCents: 1000,
      createdAt: "",
      submittedAt: null,
      stripeTransferId: "tr_1",
      destinationAccountId: "acct",
      blockedReason: null,
      failureMessage: null,
      clawbackBadge: "manual_review" as const,
      legacyClawbackReviewStatus: null,
      financialReviewKind: "manual" as const,
    };
    expect(transferNeedsAction(row)).toBe(true);
    expect(transferProblemLabel(row)).toBe("Manual review");
  });

  it("uses compact labels for insufficient balance rows", () => {
    const row = {
      ...baseTransfer,
      status: "blocked_insufficient_balance",
      stripeTransferId: null,
    };
    expect(transferProblemLabel(row)).toBe("Insufficient Stripe balance");
    expect(transferStatusShortLabel(row)).toBe("Retryable");
    expect(transferFundingBadgeLabel(transferFundingKind("ch_123"))).toBe("Charge-linked");
    expect(transferFundingBadgeLabel(transferFundingKind(null))).toBe("Balance-dependent");
  });

  it("counts retryable failed transfers", () => {
    expect(
      countRetryableTransfers([
        { ...baseTransfer, status: "failed", stripeTransferId: null, failureMessage: "x" },
      ])
    ).toBe(1);
  });
});
