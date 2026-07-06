import { describe, expect, it } from "vitest";
import {
  isVendorPayoutTransferHandled,
  resolveVendorPayoutGateForPayment,
} from "./pod-payout-vendor-transfer-gate";

describe("pod-payout-vendor-transfer-gate", () => {
  it("treats paid vendor transfers as handled", () => {
    expect(isVendorPayoutTransferHandled({ amountCents: 500, status: "paid" })).toBe(true);
  });

  it("treats zero-dollar vendor transfers as handled without paid status", () => {
    expect(isVendorPayoutTransferHandled({ amountCents: 0, status: "pending" })).toBe(true);
  });

  it("treats cancelled_due_to_refund vendor transfers as handled", () => {
    expect(
      isVendorPayoutTransferHandled({ amountCents: 500, status: "cancelled_due_to_refund" })
    ).toBe(true);
  });

  it("blocks while vendor transfer is pending", () => {
    expect(isVendorPayoutTransferHandled({ amountCents: 500, status: "pending" })).toBe(false);
    expect(isVendorPayoutTransferHandled({ amountCents: 500, status: "failed" })).toBe(false);
  });

  it("requires all positive vendor allocations on the payment to be handled", () => {
    expect(
      resolveVendorPayoutGateForPayment([
        {
          netVendorTransferCents: 500,
          payoutTransfer: { amountCents: 500, status: "paid" },
        },
        {
          netVendorTransferCents: 0,
          payoutTransfer: { amountCents: 0, status: "pending" },
        },
      ]).handled
    ).toBe(true);

    expect(
      resolveVendorPayoutGateForPayment([
        {
          netVendorTransferCents: 500,
          payoutTransfer: { amountCents: 500, status: "paid" },
        },
        {
          netVendorTransferCents: 300,
          payoutTransfer: { amountCents: 300, status: "pending" },
        },
      ])
    ).toEqual({ handled: false, reason: "waiting_on_vendor_transfer" });
  });

  it("waits when vendor transfer row is missing for positive allocation", () => {
    expect(
      resolveVendorPayoutGateForPayment([
        { netVendorTransferCents: 200, payoutTransfer: null },
      ])
    ).toEqual({ handled: false, reason: "waiting_on_vendor_transfer" });
  });
});
