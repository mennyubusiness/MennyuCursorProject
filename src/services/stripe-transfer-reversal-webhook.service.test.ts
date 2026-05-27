import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorPayoutTransfer: { findFirst: vi.fn() },
    vendorPayoutTransferReversal: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { syncTransferReversedFromStripeWebhook } from "./stripe-transfer-reversal-webhook.service";

describe("stripe-transfer-reversal-webhook.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unmatched when no vendor payout transfer", async () => {
    vi.mocked(prisma.vendorPayoutTransfer.findFirst).mockResolvedValue(null);
    const result = await syncTransferReversedFromStripeWebhook({
      id: "tr_1",
    } as Stripe.Transfer);
    expect(result).toEqual({
      outcome: "unmatched",
      reason: "no_vendor_payout_transfer_for_stripe_transfer",
    });
  });

  it("marks pending reversals as reversed", async () => {
    vi.mocked(prisma.vendorPayoutTransfer.findFirst).mockResolvedValue({ id: "vpt_1" } as never);
    vi.mocked(prisma.vendorPayoutTransferReversal.findMany).mockResolvedValue([
      { id: "rev_1" },
      { id: "rev_2" },
    ] as never);
    vi.mocked(prisma.vendorPayoutTransferReversal.update).mockResolvedValue({} as never);

    const result = await syncTransferReversedFromStripeWebhook({
      id: "tr_1",
    } as Stripe.Transfer);

    expect(result).toEqual({ outcome: "synced", reversalIds: ["rev_1", "rev_2"] });
    expect(prisma.vendorPayoutTransferReversal.update).toHaveBeenCalledTimes(2);
    expect(prisma.vendorPayoutTransferReversal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rev_1" },
        data: expect.objectContaining({ status: "reversed" }),
      })
    );
  });
});
