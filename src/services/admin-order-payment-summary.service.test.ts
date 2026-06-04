import { describe, expect, it } from "vitest";
import { vendorTransferUiMessage } from "./admin-order-payment-summary.service";

describe("admin-order-payment-summary.service", () => {
  it("vendorTransferUiMessage for pending transfer", () => {
    const m = vendorTransferUiMessage({ transferStatus: "pending", stripeTransferId: null });
    expect(m.message).toContain("No Stripe transfer reversal needed yet");
    expect(m.tone).toBe("neutral");
  });

  it("vendorTransferUiMessage for pending reversal row", () => {
    const m = vendorTransferUiMessage({
      transferStatus: "paid",
      stripeTransferId: "tr_123",
      reversals: [{ status: "pending" }],
    });
    expect(m.message).toContain("vendor transfer reversals");
    expect(m.tone).toBe("warning");
  });

  it("vendorTransferUiMessage for completed reversal", () => {
    const m = vendorTransferUiMessage({
      transferStatus: "paid",
      stripeTransferId: "tr_123",
      reversals: [{ status: "reversed" }],
    });
    expect(m.tone).toBe("success");
    expect(m.message).toContain("completed");
  });

  it("vendorTransferUiMessage for paid transfer with stripe id", () => {
    const m = vendorTransferUiMessage({
      transferStatus: "paid",
      stripeTransferId: "tr_123",
    });
    expect(m.message).toContain("transfer reversal");
    expect(m.tone).toBe("warning");
  });

  it("vendorTransferUiMessage for paid without stripe id", () => {
    const m = vendorTransferUiMessage({ transferStatus: "paid", stripeTransferId: null });
    expect(m.message).toContain("Stripe transfer ID is missing");
    expect(m.tone).toBe("danger");
  });

  it("vendorTransferUiMessage for cancelled due to refund", () => {
    const m = vendorTransferUiMessage({
      transferStatus: "cancelled_due_to_refund",
      stripeTransferId: null,
    });
    expect(m.message).toContain("Customer refund extinguished");
    expect(m.tone).toBe("neutral");
  });

  it("computeVendorClawbackSummary pending maps to vendor clawback pending label", async () => {
    const { computeVendorClawbackSummary } = await import("@/lib/vendor-clawback-status");
    const s = computeVendorClawbackSummary({
      transferStatus: "paid",
      stripeTransferId: "tr_1",
      transferAmountCents: 1000,
      vendorOrderTotalCents: 1000,
      vendorOrderRefundedCents: 1000,
      reversals: [{ status: "pending", amountCents: 1000 }],
    });
    expect(s.adminLabel).toBe("Vendor clawback pending");
  });

  it("full-order refund + paid transfer yields clawback missing when wired through vendor order refunded cents", async () => {
    const { computeVendorOrderRefundedCents } = await import("@/domain/order-refund");
    const { computeVendorClawbackSummary } = await import("@/lib/vendor-clawback-status");
    const vendorOrderTotalCents = 2240;
    const refunded = computeVendorOrderRefundedCents({
      vendorOrderId: "vo_1",
      vendorOrderTotalCents,
      orderRefunds: [
        {
          vendorOrderId: null,
          amountCents: 2408,
          status: "succeeded",
          refundScope: "full_order",
        },
      ],
      legacyAttempts: [],
    });
    expect(refunded).toBe(vendorOrderTotalCents);
    const clawback = computeVendorClawbackSummary({
      transferStatus: "paid",
      stripeTransferId: "tr_test",
      transferAmountCents: 2240,
      vendorOrderTotalCents,
      vendorOrderRefundedCents: refunded,
      reversals: [],
    });
    expect(clawback.adminLabel).not.toBe("Vendor clawback not needed");
    expect(clawback.hasMissingReversalSetup).toBe(true);
  });
});
