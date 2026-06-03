import { describe, expect, it } from "vitest";
import {
  buildPayoutTransferMoneyContext,
  computeVendorLiabilityTotals,
  isVendorConnectTransferPaid,
  openOrderRetainedFromPayment,
  openOrderRetainedFromVendorSlice,
  platformPayoutDisplayLabel,
  adminVendorConnectTransferStatusLabel,
  stripeNetToPlatformCents,
  vendorStillOwedCents,
} from "@/lib/stripe-money-movement";
import { reconciliationResultMessage as reconcileMsg } from "@/lib/vendor-payout-transfer-reconciliation";

describe("stripe-money-movement", () => {
  it("computes sample order 41016tcd1b style breakdown", () => {
    const customerPaymentCents = 1976;
    const stripeFeeCents = 87;
    const serviceFeeCents = 56;
    const netVendorTransferCents = 1833;

    expect(stripeNetToPlatformCents(customerPaymentCents, stripeFeeCents)).toBe(1889);
    expect(openOrderRetainedFromVendorSlice(serviceFeeCents)).toBe(56);
    expect(openOrderRetainedFromPayment(1889, netVendorTransferCents)).toBe(56);

    const ctx = buildPayoutTransferMoneyContext({
      paymentAmountCents: customerPaymentCents,
      stripeProcessingFeeCents: stripeFeeCents,
      allocationServiceFeeCents: serviceFeeCents,
      netVendorTransferCents,
      transferStatus: "blocked_insufficient_balance",
      stripeTransferId: null,
      stripeBalanceTransactionId: "txn_1",
    });

    expect(ctx.vendorStillOwedCents).toBe(1833);
    expect(ctx.openOrderRetainedCents).toBe(56);
  });

  it("vendor still owed is zero only for paid Connect transfer with tr id", () => {
    expect(
      vendorStillOwedCents({
        transferStatus: "paid",
        stripeTransferId: "tr_123",
        vendorConnectTransferOwedCents: 1833,
      })
    ).toBe(0);
    expect(
      vendorStillOwedCents({
        transferStatus: "failed",
        stripeTransferId: null,
        vendorConnectTransferOwedCents: 1833,
      })
    ).toBe(1833);
    expect(isVendorConnectTransferPaid("paid", null)).toBe(false);
    expect(isVendorConnectTransferPaid("paid", "tr_1")).toBe(true);
  });

  it("platform payout label shows unknown without balance transaction", () => {
    expect(
      platformPayoutDisplayLabel({ kind: "unknown", reason: "no_balance_transaction" })
    ).toContain("Unknown");
  });

  it("aggregates vendor liability totals", () => {
    const totals = computeVendorLiabilityTotals([
      { status: "paid", amountCents: 1000, destinationAccountId: "acct_1", stripeTransferId: "tr_1" },
      { status: "pending", amountCents: 200, destinationAccountId: "acct_1" },
      { status: "failed", amountCents: 500, destinationAccountId: "acct_1" },
      { status: "blocked_insufficient_balance", amountCents: 300, destinationAccountId: "acct_1" },
      { status: "blocked_idempotency_mismatch", amountCents: 100, destinationAccountId: "acct_1" },
    ]);
    expect(totals.vendorPaidCents).toBe(1000);
    expect(totals.vendorOwedCents).toBe(1100);
    expect(totals.readyToTransferCents).toBe(200);
    expect(totals.blockedInsufficientBalanceCents).toBe(300);
    expect(totals.idempotencyMismatchCents).toBe(100);
  });
});

describe("reconciliation messaging distinguishes platform payout from vendor transfer", () => {
  it("explains unpaid vendor when customer payment exists", () => {
    const msg = reconcileMsg("unchanged_not_found", undefined, {
      hasCustomerPayment: true,
      platformPayoutPaidOut: true,
    });
    expect(msg).toContain("Customer payment exists");
    expect(msg).toContain("still unpaid");
    expect(msg).toContain("Platform payout to Open Order bank found");
    expect(msg).toContain("does not count as vendor payment");
  });

  it("marks paid only from Connect transfer reconciliation outcome", () => {
    expect(reconcileMsg("updated_paid")).toContain("vendor paid via Connect");
  });
});

describe("adminVendorConnectTransferStatusLabel", () => {
  it("labels paid Connect transfer status for admin UI", () => {
    expect(adminVendorConnectTransferStatusLabel("paid")).toBe("vendor paid via Connect");
    expect(adminVendorConnectTransferStatusLabel("blocked_insufficient_balance")).toContain(
      "Vendor transfer blocked"
    );
    expect(adminVendorConnectTransferStatusLabel("blocked_idempotency_mismatch")).toBe(
      "Manual review: Stripe idempotency mismatch"
    );
  });
});
