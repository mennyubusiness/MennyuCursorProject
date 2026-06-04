import { describe, expect, it } from "vitest";
import {
  financialReviewIssueLabel,
  vendorNeedsFinancialReview,
} from "./clawback-financial-review";
import { transferNeedsAction } from "./admin-payout-transfers-ux";

describe("clawback-financial-review", () => {
  it("detects open manual financial review on paid transfer", () => {
    expect(
      vendorNeedsFinancialReview({
        clawback: { clawbackStatus: "manual_review", recommendedAction: "manual_review" },
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
        paidViaConnect: true,
      })
    ).toBe(true);
  });

  it("excludes reviewed transfers from needs action", () => {
    expect(
      transferNeedsAction({
        id: "t1",
        status: "paid",
        amountCents: 1000,
        createdAt: "",
        submittedAt: null,
        stripeTransferId: "tr_1",
        destinationAccountId: "acct",
        blockedReason: null,
        failureMessage: null,
        clawbackBadge: "manual_review",
        legacyClawbackReviewStatus: "reviewed",
        financialReviewKind: "manual",
      })
    ).toBe(false);
  });

  it("labels manual vs legacy review", () => {
    expect(financialReviewIssueLabel("manual")).toBe("Manual review");
    expect(financialReviewIssueLabel("legacy")).toBe("Legacy review");
  });
});
