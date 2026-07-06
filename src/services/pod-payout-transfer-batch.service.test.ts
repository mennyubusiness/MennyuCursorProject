import { beforeEach, describe, expect, it, vi } from "vitest";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

const mockPodPayoutTransferFindUnique = vi.fn();
const mockPodPayoutTransferFindMany = vi.fn();
const mockPodPayoutTransferUpdate = vi.fn();
const mockPodPayoutSettingsFindUnique = vi.fn();
const mockPodPayoutAllocationFindMany = vi.fn();
const mockTransaction = vi.fn();
const mockStripeTransfersCreate = vi.fn();
const mockFetchBalance = vi.fn();
const mockReEvaluate = vi.fn();

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test" },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: {
      create: (...args: unknown[]) => mockStripeTransfersCreate(...args),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    podPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockPodPayoutTransferFindUnique(...args),
      findMany: (...args: unknown[]) => mockPodPayoutTransferFindMany(...args),
      update: (...args: unknown[]) => mockPodPayoutTransferUpdate(...args),
    },
    podPayoutSettings: {
      findUnique: (...args: unknown[]) => mockPodPayoutSettingsFindUnique(...args),
    },
    podPayoutAllocation: {
      findMany: (...args: unknown[]) => mockPodPayoutAllocationFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/services/stripe-balance.service", () => ({
  fetchStripePlatformBalance: (...args: unknown[]) => mockFetchBalance(...args),
}));

vi.mock("@/services/pod-payout-transfer-recovery.service", () => ({
  reEvaluateBlockedPodPayoutTransferRows: (...args: unknown[]) => mockReEvaluate(...args),
}));

import {
  computePodPayoutTransferAdminSummaryFromData,
  executePodPayoutTransfer,
  runManualPodPayoutTransferBatchForPod,
} from "./pod-payout-transfer.service";

const readyConnect = {
  podPayoutStripeConnectedAccountId: "acct_pod",
  podPayoutStripeDetailsSubmitted: true,
  podPayoutStripePayoutsEnabled: true,
};

const vendorPaid = [
  {
    netVendorTransferCents: 800,
    payoutTransfer: { amountCents: 800, status: "paid" },
  },
];

function buildPendingTransferRow(id = "ppt_1") {
  return {
    id,
    podPayoutAllocationId: "ppa_1",
    podId: "pod_1",
    destinationAccountId: "acct_pod",
    amountCents: 43,
    currency: "usd",
    status: POD_PAYOUT_TRANSFER_STATUS.pending,
    idempotencyKey: `key_${id}`,
    stripeTransferId: null,
    blockedReason: null,
    failureMessage: null,
    podPayoutAllocation: {
      id: "ppa_1",
      podId: "pod_1",
      status: POD_PAYOUT_ALLOCATION_STATUS.pending,
      podPayoutAmountCents: 43,
      orderId: "ord_1",
      paymentId: "pay_1",
      podPayoutRecipientUserId: "user_1",
      order: { paymentRefundStatus: "none" },
      podPayoutRecipientUser: readyConnect,
      payment: { allocations: vendorPaid },
      podPayoutTransfer: { status: POD_PAYOUT_TRANSFER_STATUS.pending },
    },
  };
}

describe("computePodPayoutTransferAdminSummaryFromData", () => {
  it("does not count pending transfer rows as blocked", () => {
    const summary = computePodPayoutTransferAdminSummaryFromData({
      minimumPayoutCents: 0,
      pendingAllocations: [
        {
          id: "ppa_1",
          orderId: "ord_1",
          podPayoutAmountCents: 43,
          status: POD_PAYOUT_ALLOCATION_STATUS.pending,
          order: { paymentRefundStatus: "none" },
          podPayoutRecipientUser: readyConnect,
          payment: { allocations: vendorPaid },
          podPayoutTransfer: { status: POD_PAYOUT_TRANSFER_STATUS.pending },
        },
      ],
      transfers: [{ status: POD_PAYOUT_TRANSFER_STATUS.pending, amountCents: 43 }],
    });

    expect(summary.transferableAmountCents).toBe(43);
    expect(summary.blockedTransferAmountCents).toBe(0);
    expect(summary.blockedTransferCount).toBe(0);
  });

  it("counts failed transfer rows as blocked only", () => {
    const summary = computePodPayoutTransferAdminSummaryFromData({
      minimumPayoutCents: 0,
      pendingAllocations: [],
      transfers: [{ status: POD_PAYOUT_TRANSFER_STATUS.failed, amountCents: 43 }],
    });

    expect(summary.transferableAmountCents).toBe(0);
    expect(summary.blockedTransferAmountCents).toBe(43);
    expect(summary.blockedTransferCount).toBe(1);
  });
});

describe("executePodPayoutTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPodPayoutSettingsFindUnique.mockResolvedValue({ minimumPayoutCents: 0 });
    mockFetchBalance.mockResolvedValue({
      ok: true,
      balance: { currency: "usd", availableCents: 10_000, pendingCents: 0 },
    });
    mockPodPayoutTransferUpdate.mockResolvedValue({});
    mockStripeTransfersCreate.mockResolvedValue({ id: "tr_pod_1" });
  });

  it("attempts Stripe transfer for existing pending rows instead of skipping", async () => {
    const row = buildPendingTransferRow();
    mockPodPayoutTransferFindUnique.mockImplementation(async () => structuredClone(row));

    const result = await executePodPayoutTransfer("ppt_1", { batchKey: "batch_1" });

    expect(result).toEqual({ outcome: "paid", stripeTransferId: "tr_pod_1" });
    expect(mockStripeTransfersCreate).toHaveBeenCalledTimes(1);
    expect(mockPodPayoutTransferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ppt_1" },
        data: expect.objectContaining({
          status: POD_PAYOUT_TRANSFER_STATUS.paid,
          stripeTransferId: "tr_pod_1",
          batchKey: "batch_1",
        }),
      })
    );
  });

  it("returns waiting_on_vendor_transfer skip when vendor payout is pending", async () => {
    const row = buildPendingTransferRow();
    row.podPayoutAllocation.payment.allocations = [
      {
        netVendorTransferCents: 800,
        payoutTransfer: { amountCents: 800, status: "pending" },
      },
    ];
    row.status = POD_PAYOUT_TRANSFER_STATUS.pending;
    mockPodPayoutTransferFindUnique.mockImplementation(async () => structuredClone(row));

    const result = await executePodPayoutTransfer("ppt_1");

    expect(result).toEqual({ outcome: "skipped", reason: "waiting_on_vendor_transfer" });
    expect(mockStripeTransfersCreate).not.toHaveBeenCalled();
  });
});

describe("runManualPodPayoutTransferBatchForPod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReEvaluate.mockResolvedValue({ reEvaluated: 0 });
    mockPodPayoutSettingsFindUnique.mockResolvedValue({ minimumPayoutCents: 0 });
    mockPodPayoutAllocationFindMany.mockResolvedValue([]);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn({}));
    mockFetchBalance.mockResolvedValue({
      ok: true,
      balance: { currency: "usd", availableCents: 10_000, pendingCents: 0 },
    });
    mockPodPayoutTransferUpdate.mockResolvedValue({});
    mockStripeTransfersCreate.mockResolvedValue({ id: "tr_pod_1" });
  });

  it("includes skip reason counts when rows are skipped before Stripe", async () => {
    const row = buildPendingTransferRow("ppt_skip");
    row.podPayoutAllocation.payment.allocations = [
      {
        netVendorTransferCents: 800,
        payoutTransfer: { amountCents: 800, status: "pending" },
      },
    ];
    mockPodPayoutTransferFindMany.mockResolvedValue([
      {
        id: "ppt_skip",
        podId: "pod_1",
        status: POD_PAYOUT_TRANSFER_STATUS.pending,
        destinationAccountId: "acct_pod",
        amountCents: 43,
        currency: "usd",
      },
    ]);
    mockPodPayoutTransferFindUnique.mockImplementation(async () => structuredClone(row));

    const result = await runManualPodPayoutTransferBatchForPod("pod_1", {
      batchKey: "pod-test-batch",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.examined).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.skipReasonCounts.waiting_on_vendor_transfer).toBe(1);
    expect(result.summary.skippedRows[0]?.skipReasonKey).toBe("waiting_on_vendor_transfer");
    expect(mockStripeTransfersCreate).not.toHaveBeenCalled();
  });

  it("settles pending rows through Stripe when all gates pass", async () => {
    const row = buildPendingTransferRow("ppt_ok");
    mockPodPayoutTransferFindMany.mockResolvedValue([
      {
        id: "ppt_ok",
        podId: "pod_1",
        status: POD_PAYOUT_TRANSFER_STATUS.pending,
        destinationAccountId: "acct_pod",
        amountCents: 43,
        currency: "usd",
      },
    ]);
    mockPodPayoutTransferFindUnique.mockImplementation(async () => structuredClone(row));

    const result = await runManualPodPayoutTransferBatchForPod("pod_1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.settled).toBe(1);
    expect(result.summary.skipped).toBe(0);
    expect(mockStripeTransfersCreate).toHaveBeenCalledTimes(1);
  });
});
