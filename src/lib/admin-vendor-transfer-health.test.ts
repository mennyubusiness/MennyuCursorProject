import { describe, expect, it } from "vitest";
import {
  buildVendorTransferAttentionState,
  classifyVendorTransferAttention,
} from "./admin-vendor-transfer-health";
import { buildAdminOrderHealth } from "./admin-order-health";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";

describe("admin-vendor-transfer-health", () => {
  it("pending transfer is not blocked", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "pending",
        stripeTransferId: null,
        vendorName: "Cafe",
      })
    ).toBe("pending");
  });

  it("submitted without Stripe id is pending", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "submitted",
        stripeTransferId: null,
        vendorName: "Cafe",
      })
    ).toBe("pending");
  });

  it("paid transfer needs no attention", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "paid",
        stripeTransferId: "tr_123",
        vendorName: "Cafe",
      })
    ).toBeNull();
  });

  it("cancelled due to refund needs no attention", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "cancelled_due_to_refund",
        stripeTransferId: null,
        vendorName: "Cafe",
      })
    ).toBeNull();
  });

  it("failed transfer is failed not blocked", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "failed",
        stripeTransferId: null,
        vendorName: "Cafe",
      })
    ).toBe("failed");
  });

  it("insufficient balance is blocked", () => {
    expect(
      classifyVendorTransferAttention({
        transferStatus: "blocked_insufficient_balance",
        stripeTransferId: null,
        vendorName: "Cafe",
      })
    ).toBe("blocked");
  });

  it("pending order health does not say Vendor transfer blocked", () => {
    const summary = {
      order: {
        id: "ord_1",
        totalCents: 1000,
        serviceFeeCents: 0,
        taxCents: 0,
        tipCents: 0,
        paymentRefundStatus: "none",
        remainingRefundableCents: 0,
        stripePaymentIntentId: null,
      },
      payment: null,
      moneyMovement: null,
      refundDisplay: { refundedCents: 0, denormalizedRefundedCents: 0, inconsistentLedger: false },
      orderRefunds: [],
      refundLedgerRows: [],
      ledgerSummary: null,
      vendorOrders: [
        {
          id: "vo_1",
          vendorName: "Cafe",
          transferStatus: "pending",
          stripeTransferId: null,
          vendorStillOwedCents: 870,
          clawback: {
            clawbackStatus: "not_needed",
            clawbackRequiredCents: 0,
            clawbackRecoveredCents: 0,
            hasMissingReversalSetup: false,
            adminLabel: "Not needed",
            adminDetail: null,
            adminWarning: null,
            recommendedAction: null,
          },
          legacyClawbackReview: null,
          reversalPrepare: { canPrepare: false, blockReason: null },
        },
      ],
    } as AdminOrderPaymentSummary;
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "none",
      paymentSummary: summary,
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.title).toBe("Vendor transfer pending");
    expect(health.explanation).not.toMatch(/could not be sent/i);
    expect(health.explanation).not.toMatch(/blocked/i);
    expect(health.tone).toBe("neutral");
  });

  it("pending with vendorStillOwed does not use blocked wording", () => {
    const health = buildVendorTransferAttentionState([
      {
        transferStatus: "pending",
        stripeTransferId: null,
        vendorName: "Bistro",
      },
    ]);
    expect(health?.title).toBe("Vendor transfer pending");
    expect(health?.explanation).not.toMatch(/could not be sent/i);
  });

  it("failed renders failed copy", () => {
    const health = buildVendorTransferAttentionState([
      {
        transferStatus: "failed",
        stripeTransferId: null,
        vendorName: "Bistro",
      },
    ]);
    expect(health?.title).toBe("Vendor transfer failed");
    expect(health?.tone).toBe("urgent");
  });

  it("cancelled due to refund does not create order attention", () => {
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "fully_refunded",
      paymentSummary: {
        order: {
          id: "ord_1",
          totalCents: 1000,
          serviceFeeCents: 0,
          taxCents: 0,
          tipCents: 0,
          paymentRefundStatus: "fully_refunded",
          remainingRefundableCents: 0,
          stripePaymentIntentId: null,
        },
        payment: null,
        moneyMovement: null,
        refundDisplay: { refundedCents: 1000, denormalizedRefundedCents: 1000, inconsistentLedger: false },
        orderRefunds: [],
        refundLedgerRows: [],
        ledgerSummary: null,
        vendorOrders: [
          {
            id: "vo_1",
            vendorName: "Cafe",
            transferStatus: "cancelled_due_to_refund",
            stripeTransferId: null,
            vendorStillOwedCents: 0,
            clawback: {
              clawbackStatus: "not_needed",
              clawbackRequiredCents: 0,
              clawbackRecoveredCents: 0,
              hasMissingReversalSetup: false,
              adminLabel: "Not needed",
              adminDetail: null,
              adminWarning: null,
              recommendedAction: null,
            },
            legacyClawbackReview: null,
            reversalPrepare: { canPrepare: false, blockReason: null },
          },
        ],
      } as AdminOrderPaymentSummary,
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.title).not.toBe("Vendor transfer blocked");
    expect(health.title).not.toBe("Vendor transfer pending");
  });

  it("blocked insufficient balance renders blocked with specific copy", () => {
    const health = buildVendorTransferAttentionState([
      {
        transferStatus: "blocked_insufficient_balance",
        stripeTransferId: null,
        vendorName: "Bistro",
      },
    ]);
    expect(health?.title).toBe("Vendor transfer blocked");
    expect(health?.explanation).toMatch(/available balance/i);
  });
});
