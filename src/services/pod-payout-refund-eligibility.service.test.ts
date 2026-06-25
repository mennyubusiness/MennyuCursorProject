import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockRevalidatePath, mockPrisma } = vi.hoisted(() => {
  const mockRevalidatePath = vi.fn();
  const mockPrisma = {
    order: { findUnique: vi.fn() },
    podPayoutAllocation: { findMany: vi.fn(), update: vi.fn() },
    podPayoutTransfer: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockRevalidatePath, mockPrisma };
});

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { syncPodPayoutEligibilityAfterRefundSuccess } from "./pod-payout-refund-eligibility.service";

describe("syncPodPayoutEligibilityAfterRefundSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
  });

  it("no-ops when order has no refund", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "none" });

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.examined).toBe(0);
    expect(mockPrisma.podPayoutAllocation.findMany).not.toHaveBeenCalled();
  });

  it("no-ops when no pod allocation exists", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "full" });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([]);

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.examined).toBe(0);
    expect(mockPrisma.podPayoutAllocation.update).not.toHaveBeenCalled();
  });

  it("cancels allocation and unsent transfer on full refund", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "full" });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([
      {
        id: "ppa_1",
        podId: "pod_1",
        status: "pending",
        blockedReason: null,
        podPayoutTransfer: {
          id: "ppt_1",
          status: "pending",
          blockedReason: null,
          stripeTransferId: null,
        },
      },
    ]);

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.cancelledDueToRefund).toBe(1);
    expect(mockPrisma.podPayoutAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ppa_1" },
        data: expect.objectContaining({ status: "cancelled_due_to_refund" }),
      })
    );
    expect(mockPrisma.podPayoutTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ppt_1" },
        data: expect.objectContaining({ status: "cancelled_due_to_refund" }),
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/pods/pod_1");
  });

  it("updates allocation only when transfer row is missing", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "partial" });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([
      {
        id: "ppa_1",
        podId: "pod_1",
        status: "pending",
        blockedReason: null,
        podPayoutTransfer: null,
      },
    ]);

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.blockedPartialRefundReview).toBe(1);
    expect(mockPrisma.podPayoutTransfer.update).not.toHaveBeenCalled();
  });

  it("does not cancel paid transfer on refund after transfer", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "full" });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([
      {
        id: "ppa_1",
        podId: "pod_1",
        status: "pending",
        blockedReason: null,
        podPayoutTransfer: {
          id: "ppt_1",
          status: "paid",
          blockedReason: null,
          stripeTransferId: "tr_1",
        },
      },
    ]);

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.postTransferRefundReview).toBe(1);
    expect(mockPrisma.podPayoutTransfer.update).not.toHaveBeenCalled();
    expect(mockPrisma.podPayoutAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "blocked_partial_refund_review",
          blockedReason: "post_transfer_refund_review",
        }),
      })
    );
  });

  it("is idempotent on duplicate sync", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ paymentRefundStatus: "full" });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([
      {
        id: "ppa_1",
        podId: "pod_1",
        status: "cancelled_due_to_refund",
        blockedReason: "customer_refund_extinguished_obligation",
        podPayoutTransfer: {
          id: "ppt_1",
          status: "cancelled_due_to_refund",
          blockedReason: "customer_refund_extinguished_obligation",
          stripeTransferId: null,
        },
      },
    ]);

    const result = await syncPodPayoutEligibilityAfterRefundSuccess({ orderId: "ord_1" });

    expect(result.skippedAlreadyHandled).toBe(1);
    expect(mockPrisma.podPayoutAllocation.update).not.toHaveBeenCalled();
  });
});
