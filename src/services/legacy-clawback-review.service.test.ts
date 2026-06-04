import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: {
      findUnique,
      update,
      findMany,
    },
  },
}));

import {
  LegacyClawbackReviewError,
  markLegacyClawbackReview,
} from "@/services/legacy-clawback-review.service";

describe("markLegacyClawbackReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an admin note", async () => {
    await expect(
      markLegacyClawbackReview({
        vendorPayoutTransferId: "vpt_1",
        status: "reviewed",
        note: "   ",
      })
    ).rejects.toBeInstanceOf(LegacyClawbackReviewError);
  });

  it("persists reviewed status without touching Stripe", async () => {
    findUnique.mockResolvedValue({
      id: "vpt_1",
      status: "paid",
      stripeTransferId: "tr_123",
      legacyClawbackReviewStatus: null,
      vendorOrder: { id: "vo_1", orderId: "ord_1" },
    });
    update.mockResolvedValue({});

    const result = await markLegacyClawbackReview({
      vendorPayoutTransferId: "vpt_1",
      status: "reviewed",
      note: "Checked Stripe manually",
    });

    expect(result.status).toBe("reviewed");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vpt_1" },
        data: expect.objectContaining({
          legacyClawbackReviewStatus: "reviewed",
          legacyClawbackReviewNote: "Checked Stripe manually",
        }),
      })
    );
  });
});
