import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockTransferCreate = vi.fn();
const mockReconcile = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
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
    balance: { availableCents: 10000, pendingCents: 0, currency: "usd", retrievedAt: new Date().toISOString() },
  })),
}));

vi.mock("@/services/stripe-payment-charge-details.service", () => ({
  resolvePaymentStripeChargeId: vi.fn(async () => null),
}));

vi.mock("./vendor-payout-transfer-reconciliation.service", () => ({
  reconcileVendorPayoutTransfer: (...args: unknown[]) => mockReconcile(...args),
}));

import {
  buildRotatedIdempotencyKey,
  buildStripeTransferCreateParams,
  executeVendorPayoutTransfer,
  retryFailedVendorPayoutTransfer,
  retryVendorPayoutTransferWithNewKey,
  VENDOR_PAYOUT_TRANSFER_STATUS,
} from "./vendor-payout-transfer.service";
import {
  canRetryWithNewIdempotencyKey,
  IDEMPOTENCY_MISMATCH_DISPLAY,
  IDEMPOTENCY_MISMATCH_STATUS,
  isIdempotencyMismatchTransfer,
  isRetryablePayoutTransfer,
} from "@/lib/vendor-payout-transfer-failure";

const idempotencyStripeError = {
  type: "idempotency_error",
  message:
    "Keys for idempotent requests can only be used with the same parameters they were first used with. Try using a key other than 'mennyu_vpt_pa_1' if you meant to execute a different request.",
};

const baseRow = {
  id: "vpt_1",
  paymentAllocationId: "pa_1",
  vendorOrderId: "vo_1",
  vendorId: "v_1",
  amountCents: 1833,
  currency: "usd",
  destinationAccountId: "acct_1",
  idempotencyKey: "mennyu_vpt_pa_1",
  stripeTransferId: null,
  vendorOrder: { orderId: "ord_1" },
  paymentAllocation: {
    id: "pa_1",
    paymentId: "pay_1",
    payment: { stripeChargeId: null, stripePaymentIntentId: "pi_1" },
  },
};

const baseStripeParamsRow = {
  id: "vpt_1",
  paymentAllocationId: "pa_1",
  paymentId: "pay_1",
  vendorOrderId: "vo_1",
  vendorId: "v_1",
  orderId: "ord_1",
  amountCents: 1833,
  currency: "usd",
  destinationAccountId: "acct_1",
  stripeChargeId: null,
};

describe("vendor payout transfer idempotency mismatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockReconcile.mockResolvedValue({
      vendorPayoutTransferId: "vpt_1",
      outcome: "unchanged_not_found",
      message: "No matching Stripe transfer found",
    });
  });

  it("maps Stripe idempotency mismatch to blocked_idempotency_mismatch", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });
    mockTransferCreate.mockRejectedValue(idempotencyStripeError);

    const result = await executeVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("blocked_idempotency_mismatch");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IDEMPOTENCY_MISMATCH_STATUS,
        }),
      })
    );
    expect(mockTransferCreate).toHaveBeenCalledTimes(1);
  });

  it("normal retry does not run for idempotency mismatch rows", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: IDEMPOTENCY_MISMATCH_STATUS,
      blockedReason: "idempotency_parameter_mismatch",
      failureMessage: idempotencyStripeError.message,
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("blocked_idempotency_mismatch");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("upgrades legacy failed rows with idempotency message on retry attempt", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.failed,
      failureMessage: idempotencyStripeError.message,
    });

    const result = await retryFailedVendorPayoutTransfer("vpt_1");
    expect(result.outcome).toBe("blocked_idempotency_mismatch");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("isRetryablePayoutTransfer excludes idempotency mismatch", () => {
    expect(
      isRetryablePayoutTransfer({
        status: IDEMPOTENCY_MISMATCH_STATUS,
        stripeTransferId: null,
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
    expect(isIdempotencyMismatchTransfer({ status: IDEMPOTENCY_MISMATCH_STATUS })).toBe(true);
  });

  it("reconciliation paid outcome from new-key flow marks reconciled_paid", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: IDEMPOTENCY_MISMATCH_STATUS,
      failureMessage: IDEMPOTENCY_MISMATCH_DISPLAY,
    });
    mockReconcile.mockResolvedValue({
      outcome: "updated_paid",
      stripeTransferId: "tr_found",
      message: "paid",
    });

    const result = await retryVendorPayoutTransferWithNewKey("vpt_1");
    expect(result.outcome).toBe("reconciled_paid");
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("new-key retry uses rotated idempotency key after reconciliation no_match", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        ...baseRow,
        status: IDEMPOTENCY_MISMATCH_STATUS,
      })
      .mockResolvedValueOnce({
        ...baseRow,
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
        idempotencyKey: "mennyu_vpt_pa_1_r1",
      });
    mockReconcile.mockResolvedValue({
      outcome: "unchanged_not_found",
      message: "no match",
    });
    mockTransferCreate.mockResolvedValue({ id: "tr_new" });

    const result = await retryVendorPayoutTransferWithNewKey("vpt_1");
    expect(result.outcome).toBe("paid");
    expect(buildRotatedIdempotencyKey("pa_1", "mennyu_vpt_pa_1")).toBe("mennyu_vpt_pa_1_r1");
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: "mennyu_vpt_pa_1_r1" }
    );
  });

  it("blocks new-key retry when reconciliation is ambiguous", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: IDEMPOTENCY_MISMATCH_STATUS,
    });
    mockReconcile.mockResolvedValue({
      outcome: "unchanged_ambiguous",
      message: "ambiguous",
    });

    const result = await retryVendorPayoutTransferWithNewKey("vpt_1");
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("reconciliation_unchanged_ambiguous");
    }
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("canRetryWithNewIdempotencyKey requires reconciliation no_match", () => {
    expect(
      canRetryWithNewIdempotencyKey(
        { status: IDEMPOTENCY_MISMATCH_STATUS, stripeTransferId: null, destinationAccountId: "acct_1" },
        "unchanged_not_found"
      )
    ).toBe(true);
    expect(
      canRetryWithNewIdempotencyKey(
        { status: IDEMPOTENCY_MISMATCH_STATUS, stripeTransferId: null, destinationAccountId: "acct_1" },
        "unchanged_ambiguous"
      )
    ).toBe(false);
  });

  it("retry with same idempotency key sends identical Stripe parameters", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });
    mockTransferCreate.mockResolvedValue({ id: "tr_1" });

    await executeVendorPayoutTransfer("vpt_1");
    const firstCall = mockTransferCreate.mock.calls[0]![0];

    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
    });
    await executeVendorPayoutTransfer("vpt_1");
    const secondCall = mockTransferCreate.mock.calls[1]![0];

    expect(secondCall).toEqual(firstCall);
    expect(buildStripeTransferCreateParams(baseStripeParamsRow)).toEqual(firstCall);
  });
});
