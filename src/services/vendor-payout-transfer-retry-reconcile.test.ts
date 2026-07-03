import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockTransferCreate = vi.fn();
const mockReconcile = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: {
      create: (...args: unknown[]) => mockTransferCreate(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

vi.mock("@/services/stripe-balance.service", () => ({
  fetchStripePlatformBalance: vi.fn(async () => ({
    ok: true,
    balance: { availableCents: 100000, pendingCents: 0, currency: "usd", retrievedAt: new Date().toISOString() },
  })),
}));

vi.mock("@/services/stripe-payment-charge-details.service", () => ({
  resolvePaymentStripeChargeId: vi.fn(async () => null),
}));

vi.mock("./vendor-payout-transfer-reconciliation.service", () => ({
  reconcileVendorPayoutTransfer: (...args: unknown[]) => mockReconcile(...args),
}));

vi.mock("./vendor-payout-transfer-recovery.service", () => ({
  reEvaluateBlockedVendorPayoutTransferRows: vi.fn(async () => ({
    examined: 0,
    promotedToPending: 0,
    updatedBlocked: 0,
    unchanged: 0,
    skippedTerminal: 0,
  })),
}));

import {
  executeVendorPayoutTransfer,
  retryAllEligibleFailedVendorPayoutTransfers,
  retryFailedVendorPayoutTransfer,
  runManualVendorPayoutTransferBatch,
  VENDOR_PAYOUT_TRANSFER_STATUS,
} from "./vendor-payout-transfer.service";

const executeRow = {
  id: "vpt_1",
  paymentAllocationId: "pa_1",
  vendorOrderId: "vo_1",
  vendorId: "v_1",
  amountCents: 500,
  currency: "usd",
  destinationAccountId: "acct_1",
  idempotencyKey: "mennyu_vpt_pa_1",
  stripeTransferId: null,
  vendorOrder: { orderId: "ord_1" },
  paymentAllocation: {
    id: "pa_1",
    paymentId: "pay_1",
    payment: { stripeChargeId: "ch_1", stripePaymentIntentId: "pi_1" },
  },
};

describe("vendor payout transfer reconcile-before-send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockReconcile.mockResolvedValue({
      vendorPayoutTransferId: "vpt_1",
      outcome: "unchanged_not_found",
      message: "No matching Stripe transfer found",
    });
    mockTransferCreate.mockResolvedValue({ id: "tr_new" });
  });

  it("row retry reconciles before creating a Stripe transfer", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_1",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
      amountCents: 500,
      currency: "usd",
      destinationAccountId: "acct_1",
      stripeTransferId: null,
      failureMessage: null,
      blockedReason: null,
      idempotencyKey: "mennyu_vpt_pa_1",
    });
    mockFindUnique
      .mockResolvedValueOnce({
        id: "vpt_1",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
        amountCents: 500,
        currency: "usd",
        destinationAccountId: "acct_1",
        stripeTransferId: null,
        failureMessage: null,
        blockedReason: null,
        idempotencyKey: "mennyu_vpt_pa_1",
      })
      .mockResolvedValueOnce({
        ...executeRow,
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      });

    await retryFailedVendorPayoutTransfer("vpt_1");
    expect(mockReconcile).toHaveBeenCalledWith("vpt_1");
    expect(mockTransferCreate).toHaveBeenCalledTimes(1);
  });

  it("row retry updates local row when matching Stripe transfer exists", async () => {
    mockReconcile.mockResolvedValue({
      vendorPayoutTransferId: "vpt_1",
      outcome: "updated_paid",
      message: "Updated from Stripe",
      stripeTransferId: "tr_existing",
    });
    mockFindUnique.mockResolvedValue({
      id: "vpt_1",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
      amountCents: 500,
      currency: "usd",
      destinationAccountId: "acct_1",
      stripeTransferId: null,
      failureMessage: null,
      blockedReason: null,
      idempotencyKey: "mennyu_vpt_pa_1",
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("reconciled_paid");
    expect(mockReconcile).toHaveBeenCalledWith("vpt_1");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("execute reconciles before send and skips duplicate Stripe transfer", async () => {
    mockReconcile.mockResolvedValue({
      vendorPayoutTransferId: "vpt_1",
      outcome: "already_paid",
      message: "Already paid",
      stripeTransferId: "tr_existing",
    });
    mockFindUnique.mockResolvedValue({
      ...executeRow,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("reconciled_paid");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("run batch reconciles before send", async () => {
    mockFindMany.mockResolvedValue([
      { id: "vpt_batch", status: VENDOR_PAYOUT_TRANSFER_STATUS.pending },
    ]);
    mockFindUnique.mockResolvedValue({
      ...executeRow,
      id: "vpt_batch",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });

    await runManualVendorPayoutTransferBatch();
    expect(mockReconcile).toHaveBeenCalledWith("vpt_batch");
  });

  it("retry eligible transfers reports updated and retried counts", async () => {
    mockFindMany.mockResolvedValue([
      { id: "vpt_a", status: VENDOR_PAYOUT_TRANSFER_STATUS.failed },
      { id: "vpt_b", status: VENDOR_PAYOUT_TRANSFER_STATUS.pending },
    ]);
    mockReconcile
      .mockResolvedValueOnce({
        vendorPayoutTransferId: "vpt_a",
        outcome: "updated_paid",
        stripeTransferId: "tr_found",
        message: "found",
      })
      .mockResolvedValueOnce({
        vendorPayoutTransferId: "vpt_b",
        outcome: "unchanged_not_found",
        message: "none",
      });
    mockFindUnique
      .mockResolvedValueOnce({
        id: "vpt_a",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
        amountCents: 500,
        currency: "usd",
        destinationAccountId: "acct_1",
        stripeTransferId: null,
        failureMessage: null,
        blockedReason: null,
        idempotencyKey: "key_a",
      })
      .mockResolvedValueOnce({
        ...executeRow,
        id: "vpt_b",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      });

    const result = await retryAllEligibleFailedVendorPayoutTransfers();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.updatedFromStripe).toBe(1);
      expect(result.summary.retried).toBe(1);
    }
  });

  it("does not retry refund-blocked partial review rows", async () => {
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue({
      id: "vpt_review",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
      stripeTransferId: null,
      destinationAccountId: "acct_1",
      blockedReason: "partial_refund_manual_review",
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_review");
    expect(result.outcome).toBe("skipped");
    expect(mockReconcile).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("does not retry idempotency mismatch rows", async () => {
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue({
      id: "vpt_mismatch",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
      stripeTransferId: null,
      destinationAccountId: "acct_1",
      failureMessage: "idempotency mismatch",
      blockedReason: "idempotency_parameter_mismatch",
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_mismatch");
    expect(result.outcome).toBe("blocked_idempotency_mismatch");
    expect(mockReconcile).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });
});
