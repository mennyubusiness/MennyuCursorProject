import { describe, expect, it } from "vitest";
import { buildAdminOrderHealth, orderHasUnresolvedClawback } from "./admin-order-health";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";

function minimalPaymentSummary(
  overrides: Partial<AdminOrderPaymentSummary> = {}
): AdminOrderPaymentSummary {
  return {
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
    refundDisplay: {
      refundedCents: 0,
      denormalizedRefundedCents: 0,
      inconsistentLedger: false,
    },
    orderRefunds: [],
    refundLedgerRows: [],
    vendorOrders: [],
    ledgerSummary: null,
    ...overrides,
  } as AdminOrderPaymentSummary;
}

function vendorRow(
  overrides: Partial<AdminOrderPaymentSummary["vendorOrders"][number]> = {}
): AdminOrderPaymentSummary["vendorOrders"][number] {
  return {
    id: "vo_1",
    vendorName: "Test Vendor",
    fulfillmentStatus: "completed",
    totalCents: 1000,
    totalRefundedCents: 1000,
    remainingRefundableCents: 0,
    transferStatus: "paid",
    stripeTransferId: "tr_1",
    vendorPayoutTransferId: "vpt_1",
    grossVendorPayableCents: 900,
    allocatedProcessingFeeCents: 30,
    netVendorTransferCents: 870,
    vendorStillOwedCents: 0,
    openOrderRetainedCents: 100,
    transferAmountCents: 870,
    lineItems: [],
    reversals: [],
    reversalPrepare: { canPrepare: false, blockReason: null },
    legacyClawbackReview: null as AdminOrderPaymentSummary["vendorOrders"][number]["legacyClawbackReview"],
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
    ...overrides,
  } as AdminOrderPaymentSummary["vendorOrders"][number];
}

describe("admin-order-health", () => {
  it("completed order with no issues shows No action needed", () => {
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "none",
      paymentSummary: minimalPaymentSummary({
        vendorOrders: [vendorRow({ fulfillmentStatus: "completed" })],
      }),
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.status).toBe("ok");
    expect(health.title).toBe("No action needed");
  });

  it("manual financial review shows attention card not no action needed", () => {
    const summary = minimalPaymentSummary({
      order: {
        id: "ord_1",
        totalCents: 1000,
        serviceFeeCents: 0,
        taxCents: 0,
        tipCents: 0,
        paymentRefundStatus: "partially_refunded",
        remainingRefundableCents: 500,
        stripePaymentIntentId: null,
      },
      vendorOrders: [
        vendorRow({
          clawback: {
            clawbackStatus: "manual_review",
            clawbackRequiredCents: 500,
            clawbackRecoveredCents: 0,
            hasMissingReversalSetup: false,
            adminLabel: "Vendor clawback manual review",
            adminDetail:
              "Only a partial or non-standard refund was found. Proportional vendor reversal preparation is not automated — manual review is required.",
            adminWarning: null,
            recommendedAction: "manual_review",
          },
          reversalPrepare: { canPrepare: false, blockReason: "partial_refund_manual_review" },
          legacyClawbackReview: {
            status: null,
            note: null,
            reviewedAt: null,
            reviewedBy: null,
            needsReview: true,
            kind: "manual",
          },
        }),
      ],
    });
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "partially_refunded",
      paymentSummary: summary,
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.title).toBe("Manual financial review needed");
    expect(health.financialReview?.reviewKind).toBe("manual");
    expect(health.status).toBe("attention");
  });

  it("returns no action needed after manual review is reviewed", () => {
    const summary = minimalPaymentSummary({
      vendorOrders: [
        vendorRow({
          clawback: {
            clawbackStatus: "manual_review",
            clawbackRequiredCents: 500,
            clawbackRecoveredCents: 0,
            hasMissingReversalSetup: false,
            adminLabel: "Manual review reviewed",
            adminDetail: "Done",
            adminWarning: null,
            recommendedAction: "manual_review",
          },
          legacyClawbackReview: {
            status: "reviewed",
            note: "Checked Stripe",
            reviewedAt: "2026-06-01T00:00:00.000Z",
            reviewedBy: "admin@test",
            needsReview: false,
            kind: "manual",
          },
        }),
      ],
    });
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "partially_refunded",
      paymentSummary: summary,
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.title).toBe("No action needed");
  });

  it("clawback missing shows plain-English warning and Vendor Transfers action", () => {
    const summary = minimalPaymentSummary({
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
      vendorOrders: [
        vendorRow({
          clawback: {
            clawbackStatus: "manual_review",
            clawbackRequiredCents: 500,
            clawbackRecoveredCents: 0,
            hasMissingReversalSetup: true,
            adminLabel: "Clawback missing",
            adminDetail: null,
            adminWarning: null,
            recommendedAction: "prepare_reversal",
          },
          reversalPrepare: { canPrepare: true, blockReason: null },
        }),
      ],
    });
    expect(orderHasUnresolvedClawback(summary)).toBe(true);
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "fully_refunded",
      paymentSummary: summary,
      customerSupportIssues: [],
      vendorRecoveryContexts: [],
    });
    expect(health.title).toBe("Vendor clawback missing");
    expect(health.explanation).toMatch(/refunded after the vendor was paid/i);
    expect(health.actions.some((a) => a.href === "/admin/payout-transfers")).toBe(true);
  });

  it("open customer issue surfaces in attention card", () => {
    const health = buildAdminOrderHealth({
      orderStatus: "completed",
      paymentRefundStatus: "none",
      paymentSummary: null,
      customerSupportIssues: [
        {
          id: "iss_1",
          issueType: "need_help",
          status: "open",
          customerMessage: "Where is my food?",
          vendorName: "Cafe",
        },
      ],
      vendorRecoveryContexts: [],
    });
    expect(health.title).toBe("Customer needs help");
    expect(health.explanation).toContain("Where is my food?");
    expect(health.actions[0]?.href).toBe("#notes-issues");
  });

  it("routing failure recommends vendor order review", () => {
    const health = buildAdminOrderHealth({
      orderStatus: "paid",
      paymentRefundStatus: "none",
      paymentSummary: null,
      customerSupportIssues: [],
      vendorRecoveryContexts: [
        {
          vendorOrderId: "vo_x",
          vendorName: "Bistro",
          exceptionType: "routing_failed",
          reason: "Deliverect rejected the payload",
        },
      ],
    });
    expect(health.title).toBe("Vendor did not receive order");
    expect(health.actions[0]?.href).toBe("#vendor-order-vo_x");
  });
});
