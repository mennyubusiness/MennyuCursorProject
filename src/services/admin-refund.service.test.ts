import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.fn();
const mockOrderRefundFindUnique = vi.fn();
const mockOrderRefundUpdate = vi.fn();
const mockRefundAttemptFindUnique = vi.fn();
const mockRefundAttemptCreate = vi.fn();
const mockRefundAttemptUpdate = vi.fn();
const mockBuildPlan = vi.fn();
const mockAssertAllowed = vi.fn();
const mockRecordPending = vi.fn();
const mockLinkLedger = vi.fn();
const mockGetSummary = vi.fn();
const mockStripeRefund = vi.fn();
const mockPrepareReversals = vi.fn();
const mockGetRemainingOrder = vi.fn();
const mockGetRemainingVendor = vi.fn();
const mockOrderIssueFindFirst = vi.fn();
const mockRefundLineItemCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    orderRefund: {
      findUnique: (...args: unknown[]) => mockOrderRefundFindUnique(...args),
      update: (...args: unknown[]) => mockOrderRefundUpdate(...args),
    },
    orderIssue: { findFirst: (...args: unknown[]) => mockOrderIssueFindFirst(...args) },
    refundLineItem: { create: (...args: unknown[]) => mockRefundLineItemCreate(...args) },
    refundAttempt: {
      findUnique: (...args: unknown[]) => mockRefundAttemptFindUnique(...args),
      create: (...args: unknown[]) => mockRefundAttemptCreate(...args),
      update: (...args: unknown[]) => mockRefundAttemptUpdate(...args),
    },
  },
}));

vi.mock("@/services/refund-calculation.service", () => ({
  buildRefundExecutionPlan: (...args: unknown[]) => mockBuildPlan(...args),
  assertRefundIsAllowed: (...args: unknown[]) => mockAssertAllowed(...args),
}));

vi.mock("@/services/refund-ledger.service", () => ({
  recordPendingRefund: (...args: unknown[]) => mockRecordPending(...args),
  linkOrderRefundToRefundAttempt: (...args: unknown[]) => mockLinkLedger(...args),
  getOrderRefundSummary: (...args: unknown[]) => mockGetSummary(...args),
  getRemainingOrderRefundableCents: (...args: unknown[]) => mockGetRemainingOrder(...args),
  getRemainingVendorOrderRefundableCents: (...args: unknown[]) => mockGetRemainingVendor(...args),
}));

vi.mock("@/services/refund.service", () => ({
  executeStripeRefundForAdmin: (...args: unknown[]) => mockStripeRefund(...args),
}));

vi.mock("@/services/vendor-payout-transfer-reversal.service", () => ({
  prepareTransferReversalsForRefundAttempt: (...args: unknown[]) =>
    mockPrepareReversals(...args),
}));

const mockValidateLinkedIssue = vi.fn();
const mockLinkIssueToRefund = vi.fn();

vi.mock("@/services/order-support-issue.service", () => ({
  validateLinkedOrderIssueForAdminRefund: (...args: unknown[]) =>
    mockValidateLinkedIssue(...args),
  linkSupportIssueToOrderRefund: (...args: unknown[]) => mockLinkIssueToRefund(...args),
}));

import {
  AdminRefundError,
  assertAdminCanExecuteRefund,
  executeAdminCustomVendorOrderRefund,
  executeAdminFullOrderRefund,
  executeAdminFullVendorOrderRefund,
  executeAdminLineItemRefund,
} from "./admin-refund.service";

const basePlan = {
  orderId: "ord_1",
  vendorOrderId: null,
  refundScope: "full_order" as const,
  customerRefundAmountCents: 2000,
  remainingOrderRefundableCents: 2000,
  remainingVendorOrderRefundableCents: null,
  paymentAllocations: [],
  vendorPayoutTransfers: [],
  transferReversalRequired: false,
  transferReversalPossible: false,
  estimatedTransferReversalAmountCents: 0,
  platformWouldAbsorbRefund: false,
  platformAbsorptionPermanent: false,
  warnings: [],
  blockingReasons: [],
  idempotencyKey: "admin:full_order:ord_1:_:2000",
  stripePaymentIntentId: "pi_1",
  paymentId: "pay_1",
  stripeChargeId: "ch_1",
};

describe("admin-refund.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateLinkedIssue.mockResolvedValue({
      ok: true,
      issue: { id: "iss_1", orderId: "ord_1", vendorOrderId: null, orderLineItemId: null },
    });
    mockLinkIssueToRefund.mockResolvedValue(undefined);
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true });
    mockOrderRefundFindUnique.mockResolvedValue(null);
    mockRefundAttemptFindUnique.mockResolvedValue(null);
    mockRefundAttemptCreate.mockResolvedValue({ id: "ra_1" });
    mockRecordPending.mockResolvedValue({ id: "or_1", created: true });
    mockOrderRefundUpdate.mockResolvedValue({ id: "or_1" });
    mockLinkLedger.mockResolvedValue("or_1");
    mockGetSummary.mockResolvedValue({ orderId: "ord_1", totalRefundedCents: 2000 });
    mockStripeRefund.mockResolvedValue({
      success: true,
      refundId: "re_1",
      refundAttemptId: "ra_1",
      amountCents: 2000,
    });
    mockPrepareReversals.mockResolvedValue({
      outcome: "created_pending",
      createdCount: 1,
      transferIds: ["vpt_1"],
    });
    mockBuildPlan.mockResolvedValue({ ...basePlan });
    mockAssertAllowed.mockReturnValue({ allowed: true });
    mockGetRemainingOrder.mockResolvedValue(2000);
    mockGetRemainingVendor.mockResolvedValue(1200);
    mockOrderIssueFindFirst.mockResolvedValue(null);
    mockRefundLineItemCreate.mockResolvedValue({ id: "rli_1" });
  });

  it("rejects non-admin users in production path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    await expect(assertAdminCanExecuteRefund("user_1")).rejects.toThrow(AdminRefundError);
    vi.unstubAllEnvs();
  });

  it("admin full order refund creates pending ledger then Stripe refund", async () => {
    const result = await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "customer complaint",
    });
    expect(result.success).toBe(true);
    expect(mockRecordPending).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatedByRole: "admin",
        amountCents: 2000,
        refundScope: "full_order",
      })
    );
    expect(mockStripeRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeIdempotencyKey: "stripe_admin:full_order:ord_1:_:2000",
        metadata: expect.objectContaining({ initiatedByRole: "admin", orderRefundId: "or_1" }),
      })
    );
  });

  it("admin full vendor order refund uses vendor scope", async () => {
    mockBuildPlan.mockResolvedValue({
      ...basePlan,
      refundScope: "full_vendor_order",
      vendorOrderId: "vo_1",
      customerRefundAmountCents: 1200,
      idempotencyKey: "admin:full_vendor_order:ord_1:vo_1:1200",
    });
    await executeAdminFullVendorOrderRefund({
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      adminUserId: "admin_1",
      reason: "vendor issue",
    });
    expect(mockBuildPlan).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "full_vendor_order", vendorOrderId: "vo_1" })
    );
  });

  it("Stripe error returns failed result with ledger marked via refund service", async () => {
    mockStripeRefund.mockResolvedValue({
      success: false,
      code: "STRIPE_REFUND_FAILED",
      message: "card_error",
      amountCents: 2000,
    });
    const result = await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("STRIPE_REFUND_FAILED");
  });

  it("idempotent succeeded ledger short-circuits", async () => {
    mockOrderRefundFindUnique.mockResolvedValue({
      id: "or_existing",
      status: "succeeded",
      stripeRefundId: "re_old",
      refundAttemptId: "ra_old",
    });
    const result = await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
    });
    expect(result.idempotent).toBe(true);
    expect(mockStripeRefund).not.toHaveBeenCalled();
  });

  it("prepares transfer reversal after successful refund when not skipped", async () => {
    await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
    });
    expect(mockPrepareReversals).toHaveBeenCalledWith("ra_1");
  });

  it("skips transfer reversal when platformAbsorbsRefund on custom partial", async () => {
    mockBuildPlan.mockResolvedValue({
      ...basePlan,
      refundScope: "custom_vendor_partial",
      vendorOrderId: "vo_1",
      customerRefundAmountCents: 300,
      idempotencyKey: "admin:custom_vendor_partial:ord_1:vo_1:300",
    });
    await executeAdminCustomVendorOrderRefund({
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      amountCents: 300,
      adminUserId: "admin_1",
      reason: "goodwill",
      adminNote: "platform absorbing paid transfer",
      platformAbsorbsRefund: true,
    });
    expect(mockPrepareReversals).not.toHaveBeenCalled();
  });

  it("rejects linkedOrderIssueId from another order", async () => {
    mockValidateLinkedIssue.mockResolvedValue({
      ok: false,
      code: "ISSUE_NOT_FOUND",
      message: "Linked issue not found on this order.",
    });
    await expect(
      executeAdminFullOrderRefund({
        orderId: "ord_1",
        adminUserId: "admin_1",
        reason: "test",
        linkedOrderIssueId: "iss_bad",
      })
    ).rejects.toMatchObject({ code: "ISSUE_NOT_FOUND" });
  });

  it("links OrderIssue after successful admin refund", async () => {
    await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
      linkedOrderIssueId: "iss_1",
    });
    expect(mockLinkIssueToRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        orderRefundId: "or_1",
        issueId: "iss_1",
        requireRefundSucceeded: true,
      })
    );
  });

  it("does not link OrderIssue when Stripe refund fails", async () => {
    mockStripeRefund.mockResolvedValue({
      success: false,
      code: "STRIPE_REFUND_FAILED",
      message: "fail",
      amountCents: 2000,
    });
    await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
      linkedOrderIssueId: "iss_1",
    });
    expect(mockLinkIssueToRefund).not.toHaveBeenCalled();
  });

  it("line item refund creates RefundLineItem and Stripe metadata", async () => {
    mockBuildPlan.mockResolvedValue({
      ...basePlan,
      refundScope: "line_item_refund",
      vendorOrderId: "vo_1",
      customerRefundAmountCents: 550,
      idempotencyKey: "admin:line_item_refund:ord_1:vo_1:li_1:1:550",
      lineItem: {
        orderLineItemId: "li_1",
        itemName: "Burger",
        purchasedQuantity: 2,
        alreadyRefundedQuantity: 0,
        refundableQuantity: 2,
        requestedQuantity: 1,
        quantityRefunded: 1,
        subtotalRefundedCents: 500,
        taxRefundedCents: 50,
        tipRefundedCents: 0,
        serviceFeeRefundedCents: 0,
      },
    });
    const result = await executeAdminLineItemRefund({
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      orderLineItemId: "li_1",
      quantity: 1,
      adminUserId: "admin_1",
      reason: "wrong item",
      adminNote: "confirmed with vendor",
    });
    expect(result.success).toBe(true);
    expect(mockRecordPending).toHaveBeenCalledWith(
      expect.objectContaining({ refundScope: "line_item_refund", amountCents: 550 })
    );
    expect(mockRefundLineItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderLineItemId: "li_1",
          quantityRefunded: 1,
          amountCents: 550,
        }),
      })
    );
    expect(mockStripeRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          refundScope: "line_item_refund",
          orderLineItemId: "li_1",
        }),
      })
    );
    expect(mockPrepareReversals).not.toHaveBeenCalled();
  });

  it("line item linked issue mismatch is rejected", async () => {
    mockValidateLinkedIssue.mockResolvedValue({
      ok: false,
      code: "ISSUE_LINE_ITEM_MISMATCH",
      message: "This issue is scoped to a specific line item.",
    });
    await expect(
      executeAdminLineItemRefund({
        orderId: "ord_1",
        vendorOrderId: "vo_1",
        orderLineItemId: "li_other",
        quantity: 1,
        adminUserId: "admin_1",
        reason: "test",
        adminNote: "note",
        linkedOrderIssueId: "iss_1",
      })
    ).rejects.toMatchObject({ code: "ISSUE_LINE_ITEM_MISMATCH" });
  });

  it("blocks execution when plan has blocking reasons", async () => {
    mockBuildPlan.mockResolvedValue({
      ...basePlan,
      blockingReasons: ["admin_note_required_for_custom_partial"],
    });
    mockAssertAllowed.mockReturnValue({
      allowed: false,
      blockingReasons: ["admin_note_required_for_custom_partial"],
    });
    await expect(
      executeAdminCustomVendorOrderRefund({
        orderId: "ord_1",
        vendorOrderId: "vo_1",
        amountCents: 100,
        adminUserId: "admin_1",
        reason: "test",
      })
    ).rejects.toMatchObject({ code: "REFUND_BLOCKED" });
  });

  it("creates pending ledger before refund attempt", async () => {
    const callOrder: string[] = [];
    mockRecordPending.mockImplementation(async () => {
      callOrder.push("recordPending");
      return { id: "or_1", created: true };
    });
    mockRefundAttemptCreate.mockImplementation(async () => {
      callOrder.push("refundAttemptCreate");
      return { id: "ra_1" };
    });
    await executeAdminFullOrderRefund({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "test",
    });
    expect(callOrder).toEqual(["recordPending", "refundAttemptCreate"]);
    expect(mockOrderRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "or_1" },
        data: { refundAttemptId: "ra_1" },
      })
    );
  });

  it("maps cap errors to friendly availability-changed error", async () => {
    mockRecordPending.mockRejectedValue(
      new Error("REFUND_EXCEEDS_ORDER_REMAINING: remaining=0, requested=2408")
    );
    mockGetSummary.mockResolvedValue({
      remainingRefundableCents: 2408,
      totalRefundedCents: 0,
      paymentAmountCents: 2408,
      hasPendingRefund: false,
    });
    await expect(
      executeAdminFullOrderRefund({
        orderId: "ord_1",
        adminUserId: "admin_1",
        reason: "test",
      })
    ).rejects.toMatchObject({
      code: "REFUND_AVAILABILITY_CHANGED",
      message: "Refund availability changed since preview. Preview the refund again.",
    });
  });

  it("maps cap errors to in-progress when pending refund exists", async () => {
    mockRecordPending.mockRejectedValue(
      new Error("REFUND_EXCEEDS_ORDER_REMAINING: remaining=0, requested=2408")
    );
    mockGetSummary.mockResolvedValue({
      remainingRefundableCents: 0,
      totalRefundedCents: 0,
      paymentAmountCents: 2408,
      hasPendingRefund: true,
    });
    await expect(
      executeAdminFullOrderRefund({
        orderId: "ord_1",
        adminUserId: "admin_1",
        reason: "test",
      })
    ).rejects.toMatchObject({
      code: "REFUND_IN_PROGRESS",
      message:
        "A refund for this order is already in progress. Refresh the order before trying again.",
    });
  });

  it("blocks confirm when pending ledger row exists for idempotency key", async () => {
    mockOrderRefundFindUnique.mockResolvedValue({
      id: "or_pending",
      status: "pending",
      stripeRefundId: null,
      refundAttemptId: null,
    });
    await expect(
      executeAdminFullOrderRefund({
        orderId: "ord_1",
        adminUserId: "admin_1",
        reason: "test",
      })
    ).rejects.toMatchObject({ code: "REFUND_IN_PROGRESS" });
    expect(mockRecordPending).not.toHaveBeenCalled();
  });

  it("blocks confirm when refund attempt is already attempted", async () => {
    mockRefundAttemptFindUnique.mockResolvedValue({
      id: "ra_attempted",
      status: "attempted",
      stripeRefundId: null,
    });
    await expect(
      executeAdminFullOrderRefund({
        orderId: "ord_1",
        adminUserId: "admin_1",
        reason: "test",
      })
    ).rejects.toMatchObject({ code: "REFUND_IN_PROGRESS" });
    expect(mockRecordPending).not.toHaveBeenCalled();
  });
});
