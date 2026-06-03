import { describe, expect, it } from "vitest";
import {
  isReconcilablePayoutTransfer,
  metadataStrongMatch,
  pickUniqueStripeTransferMatch,
  reconciliationCreatedWindow,
  reconciliationAnchorDate,
  stripeTransferMatchesVendorPayoutRow,
  type VendorPayoutReconciliationRow,
} from "./vendor-payout-transfer-reconciliation";

const baseRow: VendorPayoutReconciliationRow = {
  id: "vpt_1",
  paymentAllocationId: "pa_1",
  vendorOrderId: "vo_1",
  vendorId: "v_1",
  orderId: "ord_1",
  destinationAccountId: "acct_dest",
  amountCents: 5000,
  currency: "usd",
  status: "failed",
  stripeTransferId: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  submittedAt: null,
  failedAt: new Date("2026-01-01T12:05:00Z"),
};

function transferAt(anchor: VendorPayoutReconciliationRow, offsetMs = 0) {
  const t = reconciliationAnchorDate(anchor);
  return Math.floor((t.getTime() + offsetMs) / 1000);
}

describe("vendor-payout-transfer-reconciliation lib", () => {
  it("skips paid rows with stripe transfer id for bulk eligibility", () => {
    expect(isReconcilablePayoutTransfer({ status: "paid", destinationAccountId: "acct_1", stripeTransferId: "tr_1" })).toBe(false);
    expect(isReconcilablePayoutTransfer({ status: "failed", destinationAccountId: "acct_1" })).toBe(true);
  });

  it("skips cancelled_due_to_refund rows", () => {
    expect(
      isReconcilablePayoutTransfer({
        status: "cancelled_due_to_refund",
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
  });

  it("matches retrieve path when amount/currency/destination align", () => {
    const window = reconciliationCreatedWindow(baseRow);
    const transfer = {
      id: "tr_1",
      amount: 5000,
      currency: "usd",
      destination: "acct_dest",
      reversed: false,
      created: transferAt(baseRow),
      metadata: { openOrderVendorPayoutTransferId: "vpt_1" },
    };
    const check = stripeTransferMatchesVendorPayoutRow(transfer, baseRow, window);
    expect(check.matches).toBe(true);
    expect(metadataStrongMatch(transfer.metadata, baseRow)).toBe(true);
  });

  it("rejects amount mismatch for stored stripe transfer id verification", () => {
    const window = reconciliationCreatedWindow(baseRow);
    const transfer = {
      id: "tr_1",
      amount: 4999,
      currency: "usd",
      destination: "acct_dest",
      reversed: false,
      created: transferAt(baseRow),
      metadata: { openOrderVendorPayoutTransferId: "vpt_1" },
    };
    expect(stripeTransferMatchesVendorPayoutRow(transfer, baseRow, window).matches).toBe(false);
  });

  it("marks paid from exact metadata match", () => {
    const result = pickUniqueStripeTransferMatch(
      [
        {
          id: "tr_meta",
          amount: 5000,
          currency: "usd",
          destination: "acct_dest",
          reversed: false,
          created: transferAt(baseRow),
          metadata: { paymentAllocationId: "pa_1" },
        },
      ],
      baseRow
    );
    expect(result.kind).toBe("found");
  });

  it("marks paid from single conservative fallback match", () => {
    const result = pickUniqueStripeTransferMatch(
      [
        {
          id: "tr_only",
          amount: 5000,
          currency: "usd",
          destination: "acct_dest",
          reversed: false,
          created: transferAt(baseRow),
          metadata: {},
        },
      ],
      baseRow
    );
    expect(result.kind).toBe("found");
  });

  it("leaves unchanged when no matches", () => {
    const result = pickUniqueStripeTransferMatch([], baseRow);
    expect(result.kind).toBe("none");
  });

  it("returns ambiguous when multiple matches", () => {
    const result = pickUniqueStripeTransferMatch(
      [
        {
          id: "tr_a",
          amount: 5000,
          currency: "usd",
          destination: "acct_dest",
          reversed: false,
          created: transferAt(baseRow),
          metadata: {},
        },
        {
          id: "tr_b",
          amount: 5000,
          currency: "usd",
          destination: "acct_dest",
          reversed: false,
          created: transferAt(baseRow, 1000),
          metadata: {},
        },
      ],
      baseRow
    );
    expect(result.kind).toBe("ambiguous");
  });
});
