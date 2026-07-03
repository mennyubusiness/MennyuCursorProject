import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockRetrieve = vi.fn();
const mockList = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podPayoutTransfer: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
      list: (...args: unknown[]) => mockList(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

import { reconcilePodPayoutTransfer } from "./pod-payout-transfer-reconciliation.service";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

const baseRow = {
  id: "ppt_1",
  podPayoutAllocationId: "ppa_1",
  podId: "pod_1",
  destinationAccountId: "acct_pod",
  amountCents: 500,
  currency: "usd",
  status: POD_PAYOUT_TRANSFER_STATUS.failed,
  stripeTransferId: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  submittedAt: null,
  paidAt: null,
  failedAt: new Date("2026-06-01T12:05:00.000Z"),
  podPayoutAllocation: { orderId: "ord_1" },
};

describe("reconcilePodPayoutTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({});
    mockList.mockResolvedValue({ data: [], has_more: false });
  });

  it("leaves row unchanged when no stripe transfer is found", async () => {
    mockFindUnique.mockResolvedValue(baseRow);
    const result = await reconcilePodPayoutTransfer("ppt_1");
    expect(result.outcome).toBe("unchanged_not_found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marks row paid when stripe transfer id matches", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      stripeTransferId: "tr_existing",
    });
    mockRetrieve.mockResolvedValue({
      id: "tr_existing",
      amount: 500,
      currency: "usd",
      destination: "acct_pod",
      reversed: false,
      created: Math.floor(new Date("2026-06-01T12:10:00.000Z").getTime() / 1000),
      metadata: { openOrderPodPayoutTransferId: "ppt_1" },
    });

    const result = await reconcilePodPayoutTransfer("ppt_1");
    expect(result.outcome).toBe("updated_paid");
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRetrieve).toHaveBeenCalledWith("tr_existing");
  });

  it("skips ineligible paid rows without lookup path", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRow,
      status: POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund,
    });
    const result = await reconcilePodPayoutTransfer("ppt_1");
    expect(result.outcome).toBe("skipped_ineligible");
    expect(mockRetrieve).not.toHaveBeenCalled();
  });
});
