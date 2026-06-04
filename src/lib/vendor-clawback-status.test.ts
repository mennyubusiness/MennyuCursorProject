import { describe, expect, it } from "vitest";
import {
  computeVendorClawbackSummary,
  isReversalPendingAttentionStale,
  VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES,
} from "./vendor-clawback-status";

describe("computeVendorClawbackSummary", () => {
  const paidBase = {
    transferStatus: "paid",
    stripeTransferId: "tr_123",
    transferAmountCents: 1500,
    vendorOrderTotalCents: 2000,
    vendorOrderRefundedCents: 2000,
  };

  it("returns not_needed for cancelled_due_to_refund transfer", () => {
    const s = computeVendorClawbackSummary({
      transferStatus: "cancelled_due_to_refund",
      stripeTransferId: null,
      transferAmountCents: 1500,
      vendorOrderTotalCents: 2000,
      vendorOrderRefundedCents: 2000,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("not_needed");
    expect(s.adminLabel).toMatch(/cancelled due to refund/i);
  });

  it("returns not_needed when vendor transfer was not paid via Connect", () => {
    const s = computeVendorClawbackSummary({
      transferStatus: "pending",
      stripeTransferId: null,
      transferAmountCents: 1500,
      vendorOrderTotalCents: 2000,
      vendorOrderRefundedCents: 2000,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("not_needed");
  });

  it("returns pending when reversal rows are pending", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [{ status: "pending", amountCents: 1500 }],
    });
    expect(s.clawbackStatus).toBe("pending");
    expect(s.adminLabel).toBe("Vendor clawback pending");
    expect(s.clawbackPendingCents).toBe(1500);
    expect(s.recommendedAction).toBe("run_reversal_batch");
  });

  it("returns recovered when reversal succeeded", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [{ status: "reversed", amountCents: 1500, stripeTransferReversalId: "trr_1" }],
    });
    expect(s.clawbackStatus).toBe("recovered");
    expect(s.adminLabel).toBe("Vendor clawback recovered");
    expect(s.clawbackRecoveredCents).toBe(1500);
  });

  it("returns failed when reversal failed", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [
        {
          status: "failed",
          amountCents: 1500,
          failureMessage: "Insufficient funds in connected account",
        },
      ],
    });
    expect(s.clawbackStatus).toBe("failed");
    expect(s.adminLabel).toBe("Vendor clawback failed");
    expect(s.adminWarning).toMatch(/Customer was refunded/);
    expect(s.recommendedAction).toBe("retry_reversal");
  });

  it("returns manual_review when paid transfer refunded but no reversal rows", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("manual_review");
    expect(s.adminLabel).toBe("Vendor clawback missing");
    expect(s.adminDetail).toMatch(
      /Customer was refunded after this vendor was paid\. Vendor transfer reversal is required\./
    );
    expect(s.hasMissingReversalSetup).toBe(true);
    expect(s.clawbackRequiredCents).toBe(1500);
  });

  it("does not say clawback not needed when full-order refund applies via vendorOrderRefundedCents", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      vendorOrderRefundedCents: 2000,
      reversals: [],
    });
    expect(s.clawbackStatus).not.toBe("not_needed");
    expect(s.adminLabel).not.toBe("Vendor clawback not needed");
  });

  it("full-order refund + paid transfer + pending reversal → pending", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [{ status: "submitted", amountCents: 1500 }],
    });
    expect(s.clawbackStatus).toBe("pending");
  });

  it("full-order refund + paid transfer + reversed reversal → recovered", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [{ status: "reversed", amountCents: 1500 }],
    });
    expect(s.clawbackStatus).toBe("recovered");
    expect(s.adminLabel).toBe("Vendor clawback recovered");
  });

  it("full-order refund + paid transfer + failed reversal → failed", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      reversals: [{ status: "failed", amountCents: 1500 }],
    });
    expect(s.clawbackStatus).toBe("failed");
  });

  it("unsent vendor transfer after full-order refund → not needed", () => {
    const s = computeVendorClawbackSummary({
      transferStatus: "cancelled_due_to_refund",
      stripeTransferId: null,
      transferAmountCents: 1500,
      vendorOrderTotalCents: 2000,
      vendorOrderRefundedCents: 2000,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("not_needed");
    expect(s.adminLabel).toMatch(/cancelled due to refund/i);
  });

  it("does not require clawback when transfer was never paid via Connect", () => {
    const s = computeVendorClawbackSummary({
      transferStatus: "pending",
      stripeTransferId: null,
      transferAmountCents: null,
      vendorOrderTotalCents: 2000,
      vendorOrderRefundedCents: 2000,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("not_needed");
  });

  it("returns manual_review for partial refund on paid transfer", () => {
    const s = computeVendorClawbackSummary({
      ...paidBase,
      vendorOrderRefundedCents: 500,
      reversals: [],
    });
    expect(s.clawbackStatus).toBe("manual_review");
    expect(s.adminLabel).toMatch(/manual review/i);
  });
});

describe("isReversalPendingAttentionStale", () => {
  it("flags pending reversals older than threshold", () => {
    const now = Date.now();
    const createdAt = new Date(now - (VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES + 5) * 60 * 1000);
    expect(
      isReversalPendingAttentionStale({ status: "pending", createdAt }, now)
    ).toBe(true);
    expect(
      isReversalPendingAttentionStale({ status: "pending", createdAt: new Date(now - 60_000) }, now)
    ).toBe(false);
  });
});
