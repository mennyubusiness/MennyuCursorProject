import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockStripeList = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    refundAttempt: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    orderRefund: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    refunds: {
      list: (...args: unknown[]) => mockStripeList(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test" },
}));

import {
  dismissStaleRefundAttempt,
  StaleRefundAttemptError,
} from "./stale-refund-attempt.service";

describe("stale-refund-attempt.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockStripeList.mockResolvedValue({ data: [] });
    mockUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValue({
      id: "ra_1",
      orderId: "ord_1",
      status: "attempted",
      amountCents: 2408,
      stripeRefundId: null,
      dismissedAsLegacyAt: null,
      idempotencyKey: "admin:full_order:ord_1:_:2408",
      failureCode: null,
      failureMessage: null,
      createdAt: new Date("2026-06-03T22:50:02.533Z"),
      order: { stripePaymentIntentId: "pi_1" },
      orderRefund: null,
    });
  });

  it("dismisses orphaned attempted RefundAttempt", async () => {
    const result = await dismissStaleRefundAttempt({ refundAttemptId: "ra_1" });
    expect(result.alreadyDismissed).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ra_1" },
        data: expect.objectContaining({ dismissedAsLegacyAt: expect.any(Date) }),
      })
    );
  });

  it("blocks dismiss when Stripe shows matching pending refund", async () => {
    mockStripeList.mockResolvedValue({
      data: [{ id: "re_1", amount: 2408, status: "pending", metadata: {} }],
    });
    await expect(dismissStaleRefundAttempt({ refundAttemptId: "ra_1" })).rejects.toMatchObject({
      code: "STRIPE_VERIFY_FAILED",
    });
  });

  it("rejects succeeded attempts", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ra_1",
      orderId: "ord_1",
      status: "succeeded",
      amountCents: 2408,
      stripeRefundId: "re_1",
      dismissedAsLegacyAt: null,
      idempotencyKey: "k",
      failureCode: null,
      failureMessage: null,
      createdAt: new Date(),
      order: { stripePaymentIntentId: "pi_1" },
      orderRefund: { id: "or_1", status: "succeeded", refundAttemptId: "ra_1" },
    });
    await expect(dismissStaleRefundAttempt({ refundAttemptId: "ra_1" })).rejects.toBeInstanceOf(
      StaleRefundAttemptError
    );
  });
});
