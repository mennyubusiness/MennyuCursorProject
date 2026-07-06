import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPodPayoutSettingsFindUnique = vi.fn();
const mockPodPayoutAllocationFindMany = vi.fn();
const mockPodPayoutTransferFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podPayoutSettings: {
      findUnique: (...args: unknown[]) => mockPodPayoutSettingsFindUnique(...args),
    },
    podPayoutAllocation: {
      findMany: (...args: unknown[]) => mockPodPayoutAllocationFindMany(...args),
    },
    podPayoutTransfer: {
      findMany: (...args: unknown[]) => mockPodPayoutTransferFindMany(...args),
    },
  },
}));

import { getPodPayoutTransferAdminSummary } from "./pod-payout-transfer.service";
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";

describe("getPodPayoutTransferAdminSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPodPayoutSettingsFindUnique.mockResolvedValue({ minimumPayoutCents: 0 });
    mockPodPayoutTransferFindMany.mockResolvedValue([]);
  });

  it("counts transferable from pending allocations without transfer rows when vendor is paid", async () => {
    mockPodPayoutAllocationFindMany.mockResolvedValue([
      {
        id: "ppa_1",
        orderId: "ord_1",
        podPayoutAmountCents: 43,
        status: POD_PAYOUT_ALLOCATION_STATUS.pending,
        order: { paymentRefundStatus: "none" },
        podPayoutRecipientUser: {
          podPayoutStripeConnectedAccountId: "acct_pod",
          podPayoutStripeDetailsSubmitted: true,
          podPayoutStripePayoutsEnabled: true,
        },
        payment: {
          allocations: [
            {
              netVendorTransferCents: 500,
              payoutTransfer: { amountCents: 500, status: "paid" },
            },
          ],
        },
        podPayoutTransfer: null,
      },
      {
        id: "ppa_2",
        orderId: "ord_2",
        podPayoutAmountCents: 38,
        status: POD_PAYOUT_ALLOCATION_STATUS.pending,
        order: { paymentRefundStatus: "none" },
        podPayoutRecipientUser: {
          podPayoutStripeConnectedAccountId: "acct_pod",
          podPayoutStripeDetailsSubmitted: true,
          podPayoutStripePayoutsEnabled: true,
        },
        payment: {
          allocations: [
            {
              netVendorTransferCents: 400,
              payoutTransfer: { amountCents: 400, status: "pending" },
            },
          ],
        },
        podPayoutTransfer: null,
      },
    ]);

    const summary = await getPodPayoutTransferAdminSummary("pod_1");
    expect(summary.pendingAllocationCount).toBe(2);
    expect(summary.pendingAllocationAmountCents).toBe(81);
    expect(summary.transferableCount).toBe(1);
    expect(summary.transferableAmountCents).toBe(43);
    expect(summary.canRunPayoutBatch).toBe(true);
    expect(summary.nonTransferableAllocations).toHaveLength(1);
    expect(summary.nonTransferableAllocations[0]?.reason).toBe("waiting_on_vendor_transfer");
  });

  it("does not count pending transfer rows as blocked in summary totals", async () => {
    mockPodPayoutAllocationFindMany.mockResolvedValue([
      {
        id: "ppa_1",
        orderId: "ord_1",
        podPayoutAmountCents: 302,
        status: POD_PAYOUT_ALLOCATION_STATUS.pending,
        order: { paymentRefundStatus: "none" },
        podPayoutRecipientUser: {
          podPayoutStripeConnectedAccountId: "acct_pod",
          podPayoutStripeDetailsSubmitted: true,
          podPayoutStripePayoutsEnabled: true,
        },
        payment: {
          allocations: [
            {
              netVendorTransferCents: 500,
              payoutTransfer: { amountCents: 500, status: "paid" },
            },
          ],
        },
        podPayoutTransfer: { status: "pending" },
      },
    ]);
    mockPodPayoutTransferFindMany.mockResolvedValue([
      { status: "pending", amountCents: 302 },
    ]);

    const summary = await getPodPayoutTransferAdminSummary("pod_1");
    expect(summary.transferableAmountCents).toBe(302);
    expect(summary.blockedTransferAmountCents).toBe(0);
    expect(summary.blockedTransferCount).toBe(0);
  });

  it("reports zero transferable only when every pending allocation has a real blocker", async () => {
    mockPodPayoutAllocationFindMany.mockResolvedValue([
      {
        id: "ppa_3",
        orderId: "ord_3",
        podPayoutAmountCents: 50,
        status: POD_PAYOUT_ALLOCATION_STATUS.pending,
        order: { paymentRefundStatus: "none" },
        podPayoutRecipientUser: {
          podPayoutStripeConnectedAccountId: "acct_pod",
          podPayoutStripeDetailsSubmitted: true,
          podPayoutStripePayoutsEnabled: true,
        },
        payment: {
          allocations: [
            {
              netVendorTransferCents: 400,
              payoutTransfer: { amountCents: 400, status: "failed" },
            },
          ],
        },
        podPayoutTransfer: null,
      },
    ]);

    const summary = await getPodPayoutTransferAdminSummary("pod_1");
    expect(summary.transferableCount).toBe(0);
    expect(summary.canRunPayoutBatch).toBe(false);
  });
});
