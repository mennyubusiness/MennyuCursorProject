import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUniqueAllocation = vi.fn();
const mockFindUniqueSettings = vi.fn();
const mockCreateAllocation = vi.fn();

import { ensurePodPayoutAllocationForPaymentInTx } from "./pod-payout-allocation.service";

const baseInput = {
  paymentId: "pay_1",
  orderId: "ord_1",
  podId: "pod_1",
  eligibleSubtotalCents: 10_000,
};

function makeTx() {
  return {
    podPayoutAllocation: {
      findUnique: mockFindUniqueAllocation,
      create: mockCreateAllocation,
    },
    podPayoutSettings: {
      findUnique: mockFindUniqueSettings,
    },
  };
}

describe("ensurePodPayoutAllocationForPaymentInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUniqueAllocation.mockResolvedValue(null);
    mockCreateAllocation.mockResolvedValue({ id: "ppa_1" });
  });

  it("is idempotent when allocation already exists for paymentId", async () => {
    mockFindUniqueAllocation.mockResolvedValue({ id: "ppa_existing" });

    const result = await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, baseInput);

    expect(result).toEqual({ created: false, skipped: false });
    expect(mockFindUniqueSettings).not.toHaveBeenCalled();
    expect(mockCreateAllocation).not.toHaveBeenCalled();
  });

  it("skips when no settings", async () => {
    mockFindUniqueSettings.mockResolvedValue(null);

    const result = await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, baseInput);

    expect(result).toEqual({ created: false, skipped: true });
    expect(mockCreateAllocation).not.toHaveBeenCalled();
  });

  it("skips when payouts disabled", async () => {
    mockFindUniqueSettings.mockResolvedValue({
      podPayoutsEnabled: false,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: "user_1",
    });

    const result = await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, baseInput);

    expect(result).toEqual({ created: false, skipped: true });
    expect(mockCreateAllocation).not.toHaveBeenCalled();
  });

  it("creates pending allocation when enabled with recipient", async () => {
    mockFindUniqueSettings.mockResolvedValue({
      podPayoutsEnabled: true,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: "user_owner",
    });

    const result = await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, baseInput);

    expect(result).toEqual({ created: true, skipped: false });
    expect(mockCreateAllocation).toHaveBeenCalledWith({
      data: {
        podId: "pod_1",
        orderId: "ord_1",
        paymentId: "pay_1",
        eligibleSubtotalCents: 10_000,
        revenueShareBps: 50,
        podPayoutAmountCents: 50,
        status: "pending",
        blockedReason: null,
        podPayoutRecipientUserId: "user_owner",
      },
    });
  });

  it("creates blocked allocation when recipient missing", async () => {
    mockFindUniqueSettings.mockResolvedValue({
      podPayoutsEnabled: true,
      podRevenueShareBps: 50,
      podPayoutRecipientUserId: null,
    });

    await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, baseInput);

    expect(mockCreateAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "blocked",
          blockedReason: "missing_recipient",
        }),
      })
    );
  });

  it("uses eligibleSubtotalCents from input (Order.subtotalCents)", async () => {
    mockFindUniqueSettings.mockResolvedValue({
      podPayoutsEnabled: true,
      podRevenueShareBps: 100,
      podPayoutRecipientUserId: "user_1",
    });

    await ensurePodPayoutAllocationForPaymentInTx(makeTx() as never, {
      ...baseInput,
      eligibleSubtotalCents: 7500,
    });

    expect(mockCreateAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eligibleSubtotalCents: 7500,
          podPayoutAmountCents: 75,
        }),
      })
    );
  });
});
