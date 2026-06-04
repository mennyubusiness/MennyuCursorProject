import { describe, expect, it } from "vitest";
import {
  transferClawbackBadgeClass,
  transferClawbackBadgeFromSummary,
  transferClawbackBadgeLabel,
} from "@/lib/admin-payout-transfer-clawback-badge";
import type { VendorClawbackSummary } from "@/lib/vendor-clawback-status";

function summary(partial: Partial<VendorClawbackSummary>): VendorClawbackSummary {
  return {
    clawbackRequiredCents: 1000,
    clawbackRecoveredCents: 0,
    clawbackPendingCents: 0,
    clawbackFailedCents: 0,
    clawbackStatus: "not_needed",
    adminLabel: "",
    adminDetail: null,
    adminWarning: null,
    hasFailedReversal: false,
    hasPendingReversal: false,
    hasMissingReversalSetup: false,
    recommendedAction: "none",
    ...partial,
  };
}

describe("admin-payout-transfer-clawback-badge", () => {
  it("returns null when clawback is not needed", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({ clawbackStatus: "not_needed" }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
      })
    ).toBeNull();
  });

  it("shows pending badge when reversal is pending", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "pending",
          hasPendingReversal: true,
          clawbackPendingCents: 1000,
        }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
      })
    ).toBe("pending");
    expect(transferClawbackBadgeLabel("pending")).toBe("Clawback pending");
    expect(transferClawbackBadgeClass("pending")).toMatch(/amber/);
  });

  it("shows manual review badge for partial refund manual review", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "manual_review",
          hasMissingReversalSetup: true,
          recommendedAction: "manual_review",
          adminLabel: "Vendor clawback manual review",
        }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
      })
    ).toBe("manual_review");
    expect(transferClawbackBadgeLabel("manual_review")).toBe("Manual review");
  });

  it("shows missing badge when reversal setup is missing and status is not manual_review", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "failed",
          hasFailedReversal: false,
          hasMissingReversalSetup: true,
        }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
      })
    ).toBe("failed");
  });

  it("shows legacy review for unsafe linkage until reviewed", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "manual_review",
          hasMissingReversalSetup: true,
        }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: true,
      })
    ).toBe("legacy_review");
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "manual_review",
          hasMissingReversalSetup: true,
        }),
        legacyClawbackReviewStatus: "reviewed",
        unsafeLegacyRefundLinkage: true,
      })
    ).toBeNull();
  });

  it("shows recovered when clawback is fully recovered", () => {
    expect(
      transferClawbackBadgeFromSummary({
        clawback: summary({
          clawbackStatus: "recovered",
          clawbackRecoveredCents: 1000,
          clawbackRequiredCents: 1000,
        }),
        legacyClawbackReviewStatus: null,
        unsafeLegacyRefundLinkage: false,
      })
    ).toBe("recovered");
  });
});
