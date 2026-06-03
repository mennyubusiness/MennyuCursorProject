import { describe, expect, it } from "vitest";
import {
  assertRefundAmountWithinCaps,
  computeCommittedRefundCents,
  computeRemainingRefundableCents,
  computeTotalRefundedCents,
  computeVendorOrderRefundedCents,
  derivePaymentRefundStatus,
  mapStripeRefundStatus,
} from "./order-refund";

describe("order-refund domain", () => {
  it("sums ledger and legacy refunds without double-counting linked attempts", () => {
    const totals = computeTotalRefundedCents({
      orderRefunds: [
        { amountCents: 500, status: "succeeded" },
        { amountCents: 200, status: "pending" },
      ],
      legacyAttempts: [
        { amountCents: 300, status: "succeeded", hasLinkedOrderRefund: false },
        { amountCents: 100, status: "succeeded", hasLinkedOrderRefund: true },
      ],
    });
    expect(totals.ledgerCents).toBe(500);
    expect(totals.legacyCents).toBe(300);
    expect(totals.totalCents).toBe(800);
  });

  it("computes vendor-order refunded cents from ledger + legacy", () => {
    const total = computeVendorOrderRefundedCents({
      vendorOrderId: "vo_1",
      orderRefunds: [
        { vendorOrderId: "vo_1", amountCents: 400, status: "succeeded" },
        { vendorOrderId: "vo_2", amountCents: 100, status: "succeeded" },
      ],
      legacyAttempts: [
        {
          vendorOrderId: "vo_1",
          amountCents: 150,
          status: "succeeded",
          hasLinkedOrderRefund: false,
        },
      ],
    });
    expect(total).toBe(550);
  });

  it("remaining refundable is non-negative", () => {
    expect(computeRemainingRefundableCents(1000, 300)).toBe(700);
    expect(computeRemainingRefundableCents(1000, 1200)).toBe(0);
  });

  it("derivePaymentRefundStatus respects pending", () => {
    expect(
      derivePaymentRefundStatus({
        paymentAmountCents: 1000,
        totalRefundedCents: 0,
        hasPendingRefund: true,
      })
    ).toBe("pending");
    expect(
      derivePaymentRefundStatus({
        paymentAmountCents: 1000,
        totalRefundedCents: 1000,
        hasPendingRefund: false,
      })
    ).toBe("full");
  });

  it("assertRefundAmountWithinCaps blocks over-refund at order and vendor level", () => {
    expect(() =>
      assertRefundAmountWithinCaps({
        amountCents: 600,
        orderPaidCents: 1000,
        orderRefundedCents: 500,
      })
    ).toThrow(/REFUND_EXCEEDS_ORDER_REMAINING/);

    expect(() =>
      assertRefundAmountWithinCaps({
        amountCents: 200,
        orderPaidCents: 1000,
        orderRefundedCents: 0,
        vendorOrderTotalCents: 300,
        vendorOrderRefundedCents: 150,
      })
    ).toThrow(/REFUND_EXCEEDS_VENDOR_ORDER_REMAINING/);
  });

  it("mapStripeRefundStatus maps known Stripe statuses", () => {
    expect(mapStripeRefundStatus("succeeded")).toBe("succeeded");
    expect(mapStripeRefundStatus("failed")).toBe("failed");
    expect(mapStripeRefundStatus(undefined)).toBe("pending");
  });

  it("computeCommittedRefundCents counts pending ledger but not attempted legacy", () => {
    expect(
      computeCommittedRefundCents({
        orderRefunds: [{ amountCents: 500, status: "pending" }],
        legacyAttempts: [
          { amountCents: 500, status: "attempted", hasLinkedOrderRefund: false },
        ],
      })
    ).toBe(500);
  });

  it("failed legacy refund attempt does not reduce committed refundable", () => {
    expect(
      computeCommittedRefundCents({
        orderRefunds: [],
        legacyAttempts: [
          { amountCents: 2408, status: "failed", hasLinkedOrderRefund: false },
        ],
      })
    ).toBe(0);
  });

  it("preview and confirm cap math share committed refund totals", () => {
    const paidCents = 2408;
    const committed = computeCommittedRefundCents({
      orderRefunds: [],
      legacyAttempts: [
        { amountCents: 2408, status: "attempted", hasLinkedOrderRefund: false },
      ],
    });
    const remaining = computeRemainingRefundableCents(paidCents, committed);
    expect(remaining).toBe(2408);
    expect(() =>
      assertRefundAmountWithinCaps({
        amountCents: 2408,
        orderPaidCents: paidCents,
        orderRefundedCents: committed,
      })
    ).not.toThrow();
  });
});
