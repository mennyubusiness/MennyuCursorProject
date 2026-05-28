import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefundDecision } from "@/lib/refund-decision";

vi.mock("@/lib/db", () => ({
  prisma: {
    orderRefund: { findUnique: vi.fn() },
    order: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/refund.service", () => ({
  buildRefundIdempotencyKey: vi.fn(() => "idem:test"),
  executeRefund: vi.fn(),
}));

vi.mock("@/services/refund-ledger.service", () => ({
  recordPendingRefund: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { executeRefund } from "@/services/refund.service";
import { recordPendingRefund } from "@/services/refund-ledger.service";
import {
  processRefundDecision,
  recordRefundAwaitingAdminReview,
} from "./refund-execution.service";

const baseDecision: RefundDecision = {
  required: true,
  scope: "full_order",
  reason: "customer_cancel",
  orderId: "ord_1",
  vendorOrderId: null,
  amountCents: 1500,
  canAutoRefund: true,
  requiresAdminReview: false,
};

describe("refund-execution.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requiresAdminReview queues pending OrderRefund without Stripe", async () => {
    vi.mocked(prisma.orderRefund.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      stripePaymentIntentId: "pi_1",
      payments: [{ id: "pay_1", stripePaymentIntentId: "pi_1", stripeChargeId: "ch_1" }],
    } as never);
    vi.mocked(recordPendingRefund).mockResolvedValue({ id: "or_review", created: true });

    const decision = { ...baseDecision, requiresAdminReview: true, canAutoRefund: false };
    const result = await processRefundDecision(decision);

    expect(result.outcome).toBe("admin_review_queued");
    expect(executeRefund).not.toHaveBeenCalled();
    expect(recordPendingRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        adminNote: expect.stringContaining("Awaiting platform admin review"),
      })
    );
  });

  it("canAutoRefund calls executeRefund", async () => {
    vi.mocked(executeRefund).mockResolvedValue({
      success: true,
      amountCents: 1500,
      refundAttemptId: "ra_1",
    });

    const result = await processRefundDecision(baseDecision);
    expect(result.outcome).toBe("auto_executed");
    expect(executeRefund).toHaveBeenCalledWith(baseDecision, expect.any(Object));
  });

  it("recordRefundAwaitingAdminReview is idempotent", async () => {
    vi.mocked(prisma.orderRefund.findUnique).mockResolvedValue({ id: "or_existing" } as never);
    const r = await recordRefundAwaitingAdminReview({
      ...baseDecision,
      requiresAdminReview: true,
      canAutoRefund: false,
    });
    expect(r).toEqual({ orderRefundId: "or_existing", created: false });
    expect(recordPendingRefund).not.toHaveBeenCalled();
  });
});
