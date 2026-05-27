import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.fn();
const mockOrderRefundFindUnique = vi.fn();
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

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    orderRefund: { findUnique: (...args: unknown[]) => mockOrderRefundFindUnique(...args) },
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

import {
  AdminRefundError,
  assertAdminCanExecuteRefund,
  executeAdminCustomVendorOrderRefund,
  executeAdminFullOrderRefund,
  executeAdminFullVendorOrderRefund,
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
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true });
    mockOrderRefundFindUnique.mockResolvedValue(null);
    mockRefundAttemptFindUnique.mockResolvedValue(null);
    mockRefundAttemptCreate.mockResolvedValue({ id: "ra_1" });
    mockRecordPending.mockResolvedValue({ id: "or_1", created: true });
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
});
