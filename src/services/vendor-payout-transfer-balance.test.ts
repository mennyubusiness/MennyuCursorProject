import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const mockTransferCreate = vi.fn();
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

const mockBalance = vi.fn();
vi.mock("@/services/stripe-balance.service", () => ({
  fetchStripePlatformBalance: (...args: unknown[]) => mockBalance(...args),
}));

vi.mock("@/services/stripe-payment-charge-details.service", () => ({
  resolvePaymentStripeChargeId: vi.fn(async () => null),
}));

import {
  BALANCE_UNAVAILABLE_ADMIN_MESSAGE,
  executeVendorPayoutTransfer,
  retryAllEligibleFailedVendorPayoutTransfers,
  retryFailedVendorPayoutTransfer,
  runManualVendorPayoutTransferBatch,
  VENDOR_PAYOUT_TRANSFER_STATUS,
} from "./vendor-payout-transfer.service";

describe("vendor payout transfer balance checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance.mockResolvedValue({
      ok: true,
      balance: { availableCents: 100, pendingCents: 5000, currency: "usd", retrievedAt: new Date().toISOString() },
    });
    mockUpdate.mockResolvedValue({});
  });

  it("blocks transfer without calling Stripe when available balance is too low", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_1",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      amountCents: 500,
      currency: "usd",
      destinationAccountId: "acct_1",
      idempotencyKey: "key_1",
      paymentAllocationId: "pa_1",
      vendorOrderId: "vo_1",
      vendorId: "v_1",
      stripeTransferId: null,
      vendorOrder: { orderId: "ord_1" },
      paymentAllocation: {
        id: "pa_1",
        paymentId: "pay_1",
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_1" },
      },
    });

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("blocked_insufficient_balance");
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vpt_1" },
        data: expect.objectContaining({
          status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
        }),
      })
    );
  });

  it("creates Stripe transfer with idempotency key when balance is sufficient", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_2",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      amountCents: 50,
      currency: "usd",
      destinationAccountId: "acct_1",
      idempotencyKey: "mennyu_vpt_pa_2",
      paymentAllocationId: "pa_2",
      vendorOrderId: "vo_2",
      vendorId: "v_2",
      stripeTransferId: null,
      vendorOrder: { orderId: "ord_2" },
      paymentAllocation: {
        id: "pa_2",
        paymentId: "pay_2",
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_2" },
      },
    });
    mockTransferCreate.mockResolvedValue({ id: "tr_abc" });

    const result = await executeVendorPayoutTransfer("vpt_2");
    expect(result.outcome).toBe("paid");
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50,
        destination: "acct_1",
        transfer_group: "order_ord_2",
        metadata: expect.objectContaining({
          openOrderVendorPayoutTransferId: "vpt_2",
          paymentAllocationId: "pa_2",
          orderId: "ord_2",
          mennyu_vendor_payout_transfer_id: "vpt_2",
        }),
      }),
      { idempotencyKey: "mennyu_vpt_pa_2" }
    );
  });

  it("skips retry for already-paid transfer", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_3",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
      stripeTransferId: "tr_paid",
      destinationAccountId: "acct_1",
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_3");
    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBe("already_paid");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("maps Stripe insufficient funds API error to blocked status", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_4",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      amountCents: 50,
      currency: "usd",
      destinationAccountId: "acct_1",
      idempotencyKey: "key_4",
      paymentAllocationId: "pa_4",
      vendorOrderId: "vo_4",
      vendorId: "v_4",
      stripeTransferId: null,
      vendorOrder: { orderId: "ord_4" },
      paymentAllocation: {
        id: "pa_4",
        paymentId: "pay_4",
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_4" },
      },
    });
    mockTransferCreate.mockRejectedValue({
      code: "balance_insufficient",
      message: "You have insufficient available funds in your Stripe account.",
    });

    const result = await executeVendorPayoutTransfer("vpt_4");
    expect(result.outcome).toBe("blocked_insufficient_balance");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
        }),
      })
    );
  });

  it("does not call Stripe when balance fetch fails for single execute", async () => {
    mockBalance.mockResolvedValue({ ok: false, error: "network down" });
    mockFindUnique.mockResolvedValue({
      id: "vpt_5",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      amountCents: 50,
      currency: "usd",
      destinationAccountId: "acct_1",
      idempotencyKey: "key_5",
      paymentAllocationId: "pa_5",
      vendorOrderId: "vo_5",
      vendorId: "v_5",
      stripeTransferId: null,
      vendorOrder: { orderId: "ord_5" },
      paymentAllocation: {
        id: "pa_5",
        paymentId: "pay_5",
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_5" },
      },
    });

    const result = await executeVendorPayoutTransfer("vpt_5");
    expect(result.outcome).toBe("blocked_balance_unavailable");
    expect(result.message).toBe(BALANCE_UNAVAILABLE_ADMIN_MESSAGE);
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips cancelled_due_to_refund without calling Stripe", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vpt_cancelled",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund,
      amountCents: 500,
      currency: "usd",
      destinationAccountId: "acct_1",
      stripeTransferId: null,
      blockedReason: "customer_refund_extinguished_obligation",
      vendorOrder: { orderId: "ord_1" },
      paymentAllocation: {
        id: "pa_c",
        paymentId: "pay_c",
        payment: { stripeChargeId: null, stripePaymentIntentId: "pi_c" },
      },
    });

    const result = await executeVendorPayoutTransfer("vpt_cancelled");
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("cancelled_due_to_refund");
    }
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not call Stripe or mutate row when single retry balance fetch fails", async () => {
    mockBalance.mockResolvedValue({ ok: false, error: "timeout" });
    mockFindUnique.mockResolvedValue({
      id: "vpt_6",
      status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
      amountCents: 50,
      currency: "usd",
      destinationAccountId: "acct_1",
      stripeTransferId: null,
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_6");
    expect(result.outcome).toBe("blocked_balance_unavailable");
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("batch payout does not call Stripe when balance fetch fails", async () => {
    mockBalance.mockResolvedValue({ ok: false, error: "stripe unavailable" });
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_7",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
        amountCents: 50,
        currency: "usd",
        destinationAccountId: "acct_1",
      },
    ]);

    const result = await runManualVendorPayoutTransferBatch();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("balance_unavailable");
      expect(result.error).toBe(BALANCE_UNAVAILABLE_ADMIN_MESSAGE);
      expect(result.balanceError).toBe("stripe unavailable");
    }
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("retry-all does not call Stripe when balance fetch fails", async () => {
    mockBalance.mockResolvedValue({ ok: false, error: "stripe unavailable" });
    mockFindMany.mockResolvedValue([
      {
        id: "vpt_8",
        status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
        amountCents: 50,
        currency: "usd",
        destinationAccountId: "acct_1",
        stripeTransferId: null,
      },
    ]);

    const result = await retryAllEligibleFailedVendorPayoutTransfers();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("balance_unavailable");
      expect(result.error).toBe(BALANCE_UNAVAILABLE_ADMIN_MESSAGE);
    }
    expect(mockTransferCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
