import { describe, expect, it } from "vitest";
import {
  canManualRecoverVendorOrder,
  canRetryRouting,
  formatOrderPaymentLabel,
  getNeedsAttentionSuggestedActions,
  isOrderPaidForAdminRecovery,
} from "@/lib/admin-needs-attention-actions";

const paid = { status: "paid" };
const unpaid = { status: "pending_payment" };

const routingFailedPaid = {
  routingStatus: "failed",
  fulfillmentStatus: "pending",
  deliverectOrderId: null,
  manuallyRecoveredAt: null,
};

describe("admin needs attention recovery rules", () => {
  it("treats non-pending_payment as paid for recovery", () => {
    expect(isOrderPaidForAdminRecovery({ status: "paid" })).toBe(true);
    expect(isOrderPaidForAdminRecovery(unpaid)).toBe(false);
  });

  it("allows manual recovery for routing failed paid pending vendor order", () => {
    expect(canManualRecoverVendorOrder(routingFailedPaid, paid)).toBe(true);
  });

  it("blocks manual recovery for unpaid order", () => {
    expect(canManualRecoverVendorOrder(routingFailedPaid, unpaid)).toBe(false);
  });

  it("blocks manual recovery for terminal vendor fulfillment", () => {
    expect(
      canManualRecoverVendorOrder(
        { ...routingFailedPaid, fulfillmentStatus: "cancelled" },
        paid
      )
    ).toBe(false);
    expect(
      canManualRecoverVendorOrder(
        { ...routingFailedPaid, fulfillmentStatus: "completed" },
        paid
      )
    ).toBe(false);
  });

  it("blocks manual recovery when already manually recovered", () => {
    expect(
      canManualRecoverVendorOrder(
        { ...routingFailedPaid, manuallyRecoveredAt: new Date() },
        paid
      )
    ).toBe(false);
  });

  it("allows retry for routing failed and blocks sent with deliverect id (duplicate guard)", () => {
    expect(canRetryRouting(routingFailedPaid, paid)).toBe(true);
    expect(
      canRetryRouting(
        { routingStatus: "sent", fulfillmentStatus: "pending", deliverectOrderId: "dct-1" },
        paid
      )
    ).toBe(false);
    expect(
      canRetryRouting(
        { routingStatus: "sent", fulfillmentStatus: "pending", deliverectOrderId: null },
        paid
      )
    ).toBe(true);
  });

  it("suggests manual recovery for reconciliation-overdue style sent+pending", () => {
    const vo = {
      routingStatus: "sent",
      fulfillmentStatus: "pending",
      deliverectOrderId: "ext-1",
      manuallyRecoveredAt: null,
    };
    expect(canManualRecoverVendorOrder(vo, paid)).toBe(true);
    expect(canRetryRouting(vo, paid)).toBe(false);
    expect(getNeedsAttentionSuggestedActions("deliverect_reconciliation_overdue", vo, paid)).toContain(
      "manual_recovery"
    );
  });

  it("formats payment label for admin display", () => {
    expect(formatOrderPaymentLabel("pending_payment")).toMatch(/Unpaid/);
    expect(formatOrderPaymentLabel("paid")).toBe("Paid");
  });
});
