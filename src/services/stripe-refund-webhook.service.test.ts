import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/services/refund-ledger.service", () => ({
  syncRefundFromStripeRefundObject: vi.fn(),
}));

import { syncRefundFromStripeRefundObject } from "@/services/refund-ledger.service";
import {
  handleChargeRefundedWebhook,
  handleStripeRefundWebhookEvent,
} from "./stripe-refund-webhook.service";

describe("stripe-refund-webhook.service", () => {
  beforeEach(() => {
    vi.mocked(syncRefundFromStripeRefundObject).mockReset();
  });

  const baseRefund = {
    id: "re_123",
    object: "refund",
    amount: 500,
    currency: "usd",
    status: "succeeded",
    payment_intent: "pi_abc",
    charge: "ch_abc",
    metadata: { orderId: "ord_1" },
  } as unknown as Stripe.Refund;

  it("refund.created syncs via ledger and returns handled", async () => {
    vi.mocked(syncRefundFromStripeRefundObject).mockResolvedValue({
      outcome: "synced",
      orderRefundId: "or_1",
    });

    const result = await handleStripeRefundWebhookEvent(baseRefund);
    expect(result).toEqual({ handled: true, orderRefundId: "or_1" });
    expect(syncRefundFromStripeRefundObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "re_123", amount: 500 }),
      undefined
    );
  });

  it("refund.updated syncs without throwing", async () => {
    vi.mocked(syncRefundFromStripeRefundObject).mockResolvedValue({
      outcome: "synced",
      orderRefundId: "or_2",
    });
    const updated = { ...baseRefund, status: "failed" } as Stripe.Refund;
    const result = await handleStripeRefundWebhookEvent(updated);
    expect(result.handled).toBe(true);
  });

  it("unmatched refund does not throw", async () => {
    vi.mocked(syncRefundFromStripeRefundObject).mockResolvedValue({
      outcome: "unmatched",
      reason: "no_order_id_or_payment_intent_match",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await handleStripeRefundWebhookEvent(baseRefund);
    expect(result).toEqual({
      handled: false,
      reason: "no_order_id_or_payment_intent_match",
    });
    warn.mockRestore();
  });

  it("charge.refunded iterates refunds on charge", async () => {
    vi.mocked(syncRefundFromStripeRefundObject).mockResolvedValue({
      outcome: "synced",
      orderRefundId: "or_3",
    });
    const charge = {
      id: "ch_1",
      refunds: { data: [baseRefund, { ...baseRefund, id: "re_456" }] },
    } as Stripe.Charge;
    const results = await handleChargeRefundedWebhook(charge);
    expect(results).toHaveLength(2);
    expect(syncRefundFromStripeRefundObject).toHaveBeenCalledTimes(2);
  });
});
