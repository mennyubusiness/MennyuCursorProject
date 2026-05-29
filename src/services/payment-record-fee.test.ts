import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPaymentFindUnique = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentUpdate = vi.fn();
const mockAllocationCreate = vi.fn();
const mockAllocationUpdate = vi.fn();
const mockVptFindUnique = vi.fn();
const mockVptUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockEnsureVpt = vi.fn();
const mockFetchChargeDetails = vi.fn();
const mockFetchFee = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    payment: {
      findUnique: (...args: unknown[]) => mockPaymentFindUnique(...args),
      create: (...args: unknown[]) => mockPaymentCreate(...args),
      update: (...args: unknown[]) => mockPaymentUpdate(...args),
    },
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
    paymentAllocation: {
      create: (...args: unknown[]) => mockAllocationCreate(...args),
      update: (...args: unknown[]) => mockAllocationUpdate(...args),
    },
    vendorPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockVptFindUnique(...args),
      update: (...args: unknown[]) => mockVptUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {},
}));

vi.mock("@/services/stripe-payment-charge-details.service", () => ({
  fetchPaymentIntentChargeDetails: (...args: unknown[]) => mockFetchChargeDetails(...args),
}));

vi.mock("@/services/stripe-processing-fee.service", () => ({
  fetchStripeProcessingFeeCents: (...args: unknown[]) => mockFetchFee(...args),
  isDevBypassStripePaymentIntentId: (id: string) => id.startsWith("dev_bypass_"),
}));

vi.mock("@/services/vendor-payout-transfer.service", () => ({
  ensureVendorPayoutTransferRecordsForPaymentInTx: (...args: unknown[]) => mockEnsureVpt(...args),
}));

import {
  recordPaymentAndAllocations,
  refreshDeferredPaymentStripeFeeSnapshot,
} from "./payment.service";

const ORDER_ID = "ord_fee_test";
const PI_ID = "pi_fee_test";
const IDEM = "stripe_evt_1";

const vendorOrder = {
  id: "vo_1",
  subtotalCents: 2000,
  taxCents: 200,
  tipCents: 100,
  serviceFeeCents: 50,
  totalCents: 2350,
};

function pendingOrder() {
  return {
    id: ORDER_ID,
    status: "pending_payment",
    totalCents: 2350,
    vendorOrders: [vendorOrder],
  };
}

function makeTx() {
  return {
    payment: {
      create: mockPaymentCreate,
      update: mockPaymentUpdate,
    },
    paymentAllocation: {
      create: mockAllocationCreate,
      update: mockAllocationUpdate,
    },
    vendorPayoutTransfer: {
      findUnique: mockVptFindUnique,
      update: mockVptUpdate,
    },
  };
}

describe("recordPaymentAndAllocations fee timing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentFindUnique.mockResolvedValue(null);
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentCreate.mockResolvedValue({ id: "pay_1" });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );
    mockEnsureVpt.mockResolvedValue(undefined);
    mockFetchFee.mockResolvedValue(null);
  });

  it("records fee and allocates when Stripe fee is available", async () => {
    mockFetchChargeDetails.mockResolvedValue({
      chargeId: "ch_1",
      balanceTransactionId: "txn_1",
      feeCents: 85,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await recordPaymentAndAllocations(ORDER_ID, PI_ID, IDEM);

    expect(result.created).toBe(true);
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeProcessingFeeCents: 85,
          stripeChargeId: "ch_1",
          stripeBalanceTransactionId: "txn_1",
        }),
      })
    );
    expect(mockAllocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allocatedProcessingFeeCents: 85,
          netVendorTransferCents: 2300 - 85,
        }),
      })
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("payment_stripe_fee_deferred")
    );
    warnSpy.mockRestore();
  });

  it("records payment with null fee when balance_transaction is missing", async () => {
    mockFetchChargeDetails.mockResolvedValue({
      chargeId: "ch_1",
      balanceTransactionId: null,
      feeCents: null,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await recordPaymentAndAllocations(ORDER_ID, PI_ID, IDEM);

    expect(result.created).toBe(true);
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeProcessingFeeCents: null,
          stripeChargeId: "ch_1",
        }),
      })
    );
    expect(mockAllocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allocatedProcessingFeeCents: 0,
          netVendorTransferCents: 2300,
        }),
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("payment_stripe_fee_deferred")
    );
    warnSpy.mockRestore();
  });

  it("records payment with null fee when balance_transaction exists but fee is unavailable", async () => {
    mockFetchChargeDetails.mockResolvedValue({
      chargeId: "ch_1",
      balanceTransactionId: "txn_1",
      feeCents: null,
    });

    const result = await recordPaymentAndAllocations(ORDER_ID, PI_ID, IDEM);

    expect(result.created).toBe(true);
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeProcessingFeeCents: null,
          stripeBalanceTransactionId: "txn_1",
        }),
      })
    );
  });

  it("returns created:false for duplicate idempotency without creating again", async () => {
    mockPaymentFindUnique.mockImplementation(async (args: { where: { idempotencyKey?: string } }) => {
      if (args.where.idempotencyKey) {
        return {
          id: "pay_existing",
          stripeProcessingFeeCents: 85,
          stripePaymentIntentId: PI_ID,
          allocations: [{ allocatedProcessingFeeCents: 85 }],
        };
      }
      return null;
    });
    mockFetchFee.mockResolvedValue(85);

    const result = await recordPaymentAndAllocations(ORDER_ID, PI_ID, IDEM);

    expect(result.created).toBe(false);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
    expect(mockOrderFindUnique).not.toHaveBeenCalled();
  });

  it("returns created:false when order is no longer pending_payment", async () => {
    mockOrderFindUnique.mockResolvedValue({
      ...pendingOrder(),
      status: "paid",
    });
    mockFetchChargeDetails.mockResolvedValue({ chargeId: null, balanceTransactionId: null, feeCents: 85 });

    const result = await recordPaymentAndAllocations(ORDER_ID, PI_ID, IDEM);

    expect(result.created).toBe(false);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });
});

describe("refreshDeferredPaymentStripeFeeSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );
    mockVptFindUnique.mockResolvedValue(null);
  });

  it("backfills fee and allocation snapshots when fee becomes available", async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: "pay_1",
      stripePaymentIntentId: PI_ID,
      stripeProcessingFeeCents: null,
      stripeChargeId: "ch_1",
      stripeBalanceTransactionId: null,
      allocations: [
        {
          id: "alloc_1",
          vendorOrderId: "vo_1",
          grossVendorPayableCents: 2300,
        },
      ],
    });
    mockFetchChargeDetails.mockResolvedValue({
      chargeId: "ch_1",
      balanceTransactionId: "txn_1",
      feeCents: 85,
    });

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await refreshDeferredPaymentStripeFeeSnapshot("pay_1");

    expect(result).toEqual({ updated: true });
    expect(mockPaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeProcessingFeeCents: 85,
          stripeBalanceTransactionId: "txn_1",
        }),
      })
    );
    expect(mockAllocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          allocatedProcessingFeeCents: 85,
          netVendorTransferCents: 2215,
        },
      })
    );
    infoSpy.mockRestore();
  });

  it("no-ops when fee is still unavailable", async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: "pay_1",
      stripePaymentIntentId: PI_ID,
      stripeProcessingFeeCents: null,
      stripeChargeId: null,
      stripeBalanceTransactionId: null,
      allocations: [{ id: "alloc_1", vendorOrderId: "vo_1", grossVendorPayableCents: 2300 }],
    });
    mockFetchChargeDetails.mockResolvedValue({
      chargeId: "ch_1",
      balanceTransactionId: null,
      feeCents: null,
    });
    mockFetchFee.mockResolvedValue(null);

    const result = await refreshDeferredPaymentStripeFeeSnapshot("pay_1");

    expect(result).toEqual({ updated: false, reason: "fee_still_unavailable" });
    expect(mockPaymentUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when fee was already recorded", async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: "pay_1",
      stripePaymentIntentId: PI_ID,
      stripeProcessingFeeCents: 85,
      allocations: [],
    });

    const result = await refreshDeferredPaymentStripeFeeSnapshot("pay_1");

    expect(result).toEqual({ updated: false, reason: "fee_already_recorded" });
  });
});
