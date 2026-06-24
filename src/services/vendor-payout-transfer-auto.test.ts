import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockTransferCreate = vi.fn();
const mockResolveCharge = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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
    balance: { availableCents: 10, pendingCents: 0, currency: "usd", retrievedAt: new Date().toISOString() },
  })),
}));

vi.mock("@/services/stripe-payment-charge-details.service", () => ({
  resolvePaymentStripeChargeId: (...args: unknown[]) => mockResolveCharge(...args),
}));

import {
  buildStripeTransferCreateParams,
  executeVendorPayoutTransfer,
  executeVendorPayoutTransfersForPayment,
  retryFailedVendorPayoutTransfer,
  VENDOR_PAYOUT_TRANSFER_STATUS,
} from "./vendor-payout-transfer.service";

const executeRowBase = {
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
    payment: { stripeChargeId: "ch_abc", stripePaymentIntentId: "pi_1" },
  },
};

describe("vendor payout auto transfer and source_transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockResolveCharge.mockResolvedValue(null);
    mockTransferCreate.mockResolvedValue({ id: "tr_auto" });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        paymentAllocation: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      })
    );
  });

  it("includes source_transaction when charge ID exists", () => {
    const params = buildStripeTransferCreateParams({
      id: "vpt_1",
      paymentAllocationId: "pa_1",
      paymentId: "pay_1",
      vendorOrderId: "vo_1",
      vendorId: "v_1",
      orderId: "ord_1",
      amountCents: 500,
      currency: "usd",
      destinationAccountId: "acct_1",
      stripeChargeId: "ch_abc",
    });
    expect(params.source_transaction).toBe("ch_abc");
    expect(params.transfer_group).toBe("order_ord_1");
    expect(params.metadata.paymentId).toBe("pay_1");
  });

  it("skips platform balance check and calls Stripe when source_transaction is set", async () => {
    mockFindUnique.mockResolvedValue({
      ...executeRowBase,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("paid");
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        source_transaction: "ch_abc",
        destination: "acct_1",
      }),
      { idempotencyKey: "mennyu_vpt_pa_1" }
    );
  });

  it("backfills charge ID via resolvePaymentStripeChargeId when missing on payment row", async () => {
    mockResolveCharge.mockResolvedValue("ch_backfill");
    mockFindUnique.mockResolvedValue({
      ...executeRowBase,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      paymentAllocation: {
        ...executeRowBase.paymentAllocation,
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_1" },
      },
    });

    await executeVendorPayoutTransfer("vpt_1");
    expect(mockResolveCharge).toHaveBeenCalledWith("pay_1");
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source_transaction: "ch_backfill" }),
      expect.any(Object)
    );
  });

  it("executeVendorPayoutTransfersForPayment ensures rows and attempts pending transfers", async () => {
    mockFindMany.mockResolvedValue([
      { id: "vpt_a", status: VENDOR_PAYOUT_TRANSFER_STATUS.pending },
      { id: "vpt_b", status: VENDOR_PAYOUT_TRANSFER_STATUS.pending },
    ]);
    mockFindUnique.mockImplementation(async () => ({
      ...executeRowBase,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    }));

    const summary = await executeVendorPayoutTransfersForPayment("pay_1");
    expect(mockTransaction).toHaveBeenCalled();
    expect(summary.examined).toBe(2);
    expect(summary.settled).toBe(2);
    expect(mockTransferCreate).toHaveBeenCalledTimes(2);
  });

  it("marks insufficient funds as retryable blocked status", async () => {
    mockFindUnique.mockResolvedValue({
      ...executeRowBase,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      paymentAllocation: {
        ...executeRowBase.paymentAllocation,
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_1" },
      },
    });
    mockTransferCreate.mockRejectedValue({
      code: "balance_insufficient",
      message: "You have insufficient available funds in your Stripe account.",
    });

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("blocked_insufficient_balance");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
        }),
      })
    );
  });

  it("retryFailedVendorPayoutTransfer does not retry refund-blocked partial review rows", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_review",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
      stripeTransferId: null,
      destinationAccountId: "acct_1",
      blockedReason: "partial_refund_manual_review",
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_review");
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("blocked_partial_refund_review");
    }
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("does not duplicate successful transfer on second execute when already paid", async () => {
    mockFindUnique.mockResolvedValue({
      ...executeRowBase,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
      stripeTransferId: "tr_done",
    });

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("skipped");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });
});
