import { describe, expect, it } from "vitest";
import {
  CANCELLED_DUE_TO_REFUND_STATUS,
  isCancelledDueToRefundTransfer,
  isPaidVendorConnectTransfer,
  isPartialRefundManualReviewTransfer,
  isUnsentVendorPayoutTransferForRefund,
  isVendorTransferExecutionBlockedByRefund,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "./vendor-payout-transfer-refund-eligibility";
import {
  canRetryWithNewIdempotencyKey,
  isRetryablePayoutTransfer as isRetryableFromFailure,
} from "./vendor-payout-transfer-failure";
import { isReconcilablePayoutTransfer } from "./vendor-payout-transfer-reconciliation";
import { computeVendorLiabilityTotals, vendorStillOwedCents } from "./stripe-money-movement";

describe("vendor-payout-transfer-refund-eligibility helpers", () => {
  it("detects cancelled due to refund by status or blocked reason", () => {
    expect(isCancelledDueToRefundTransfer({ status: CANCELLED_DUE_TO_REFUND_STATUS })).toBe(true);
    expect(
      isCancelledDueToRefundTransfer({
        status: "failed",
        blockedReason: "customer_refund_extinguished_obligation",
      })
    ).toBe(true);
  });

  it("detects partial refund manual review state", () => {
    expect(isPartialRefundManualReviewTransfer({ status: PARTIAL_REFUND_MANUAL_REVIEW_STATUS })).toBe(
      true
    );
  });

  it("treats paid Connect transfers as sent and not unsent for refund cancellation", () => {
    expect(isPaidVendorConnectTransfer({ status: "paid", stripeTransferId: "tr_123" })).toBe(true);
    expect(
      isUnsentVendorPayoutTransferForRefund({ status: "paid", stripeTransferId: "tr_123" })
    ).toBe(false);
    expect(
      isUnsentVendorPayoutTransferForRefund({ status: "pending", stripeTransferId: null })
    ).toBe(true);
  });

  it("blocks execution for cancelled and partial-review transfers only", () => {
    expect(
      isVendorTransferExecutionBlockedByRefund({ status: CANCELLED_DUE_TO_REFUND_STATUS })
    ).toBe(true);
    expect(
      isVendorTransferExecutionBlockedByRefund({ status: PARTIAL_REFUND_MANUAL_REVIEW_STATUS })
    ).toBe(true);
    expect(
      isVendorTransferExecutionBlockedByRefund({ status: "paid", stripeTransferId: "tr_1" })
    ).toBe(false);
  });
});

describe("refund-aware transfer execution eligibility", () => {
  const base = { destinationAccountId: "acct_1", stripeTransferId: null as string | null };

  it("isRetryablePayoutTransfer returns false for cancelled_due_to_refund", () => {
    expect(
      isRetryableFromFailure({
        ...base,
        status: CANCELLED_DUE_TO_REFUND_STATUS,
      })
    ).toBe(false);
  });

  it("isReconcilablePayoutTransfer excludes cancelled and partial-review rows", () => {
    expect(
      isReconcilablePayoutTransfer({
        status: CANCELLED_DUE_TO_REFUND_STATUS,
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
    expect(
      isReconcilablePayoutTransfer({
        status: PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
  });

  it("canRetryWithNewIdempotencyKey rejects refund-blocked rows", () => {
    expect(
      canRetryWithNewIdempotencyKey(
        {
          status: CANCELLED_DUE_TO_REFUND_STATUS,
          destinationAccountId: "acct_1",
          stripeTransferId: null,
        },
        null
      )
    ).toBe(false);
  });

  it("vendor still owed and liability totals exclude cancelled_due_to_refund", () => {
    expect(
      vendorStillOwedCents({
        transferStatus: CANCELLED_DUE_TO_REFUND_STATUS,
        stripeTransferId: null,
        vendorConnectTransferOwedCents: 1500,
      })
    ).toBe(0);

    const totals = computeVendorLiabilityTotals([
      {
        status: CANCELLED_DUE_TO_REFUND_STATUS,
        amountCents: 1500,
        destinationAccountId: "acct_1",
      },
      { status: "pending", amountCents: 200, destinationAccountId: "acct_1" },
    ]);
    expect(totals.cancelledDueToRefundCents).toBe(1500);
    expect(totals.vendorOwedCents).toBe(200);
  });
});
