import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { webhookIdempotencyKey } from "@/lib/idempotency";

const mockConstructEvent = vi.fn();
const mockWebhookFindUnique = vi.fn();
const mockWebhookCreate = vi.fn();
const mockWebhookUpdateMany = vi.fn();
const mockProcessSuccessfulPayment = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_ci_stripe_webhook_test_secret",
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: {
      findUnique: (...args: unknown[]) => mockWebhookFindUnique(...args),
      create: (...args: unknown[]) => mockWebhookCreate(...args),
      updateMany: (...args: unknown[]) => mockWebhookUpdateMany(...args),
    },
  },
}));

vi.mock("@/services/post-payment.service", () => ({
  processSuccessfulPayment: (...args: unknown[]) => mockProcessSuccessfulPayment(...args),
}));

vi.mock("@/services/stripe-refund-webhook.service", () => ({
  handleChargeRefundedWebhook: vi.fn(),
  handleStripeRefundWebhookEvent: vi.fn(),
  handleTransferReversedWebhook: vi.fn(),
}));

import { POST } from "./route";

const ORDER_ID = "ord_test1234567890";
const PI_ID = "pi_test_webhook_1";
const EVENT_ID = "evt_test_payment_succeeded_1";
const VALID_SIGNATURE = "valid_test_signature";

function paymentIntentSucceededEvent(
  overrides?: Partial<{
    eventId: string;
    orderId: string | undefined;
    paymentIntentId: string;
  }>
): Stripe.Event {
  const eventId = overrides?.eventId ?? EVENT_ID;
  const orderId = overrides?.orderId;
  const paymentIntentId = overrides?.paymentIntentId ?? PI_ID;
  const metadata =
    orderId === undefined ? { orderId: ORDER_ID } : orderId ? { orderId } : {};

  return {
    id: eventId,
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        metadata,
      } as Stripe.PaymentIntent,
    },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

function unsupportedStripeEvent(): Stripe.Event {
  return {
    id: "evt_customer_updated",
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "customer.updated",
    data: {
      object: { id: "cus_test", object: "customer" } as Stripe.Customer,
    },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

function stripeWebhookRequest(event: Stripe.Event, signature = VALID_SIGNATURE): NextRequest {
  const body = JSON.stringify(event);
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

function mockVerifiedEvent(event: Stripe.Event) {
  mockConstructEvent.mockImplementation((body: string, sig: string) => {
    if (sig !== VALID_SIGNATURE) {
      throw new Error("No signatures found matching the expected signature for payload");
    }
    return JSON.parse(body) as Stripe.Event;
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookFindUnique.mockResolvedValue(null);
    mockWebhookCreate.mockResolvedValue({ id: "we_1" });
    mockWebhookUpdateMany.mockResolvedValue({ count: 1 });
    mockProcessSuccessfulPayment.mockResolvedValue(undefined);
    mockVerifiedEvent(paymentIntentSucceededEvent());
  });

  it("finalizes payment on valid payment_intent.succeeded webhook", async () => {
    const event = paymentIntentSucceededEvent();
    const body = JSON.stringify(event);
    const res = await POST(stripeWebhookRequest(event));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockConstructEvent).toHaveBeenCalledWith(
      body,
      VALID_SIGNATURE,
      "whsec_ci_stripe_webhook_test_secret"
    );
    expect(mockProcessSuccessfulPayment).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      idempotencyKey: `stripe_${EVENT_ID}`,
    });
    expect(mockWebhookCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "stripe",
          eventId: EVENT_ID,
          idempotencyKey: webhookIdempotencyKey("stripe", EVENT_ID, body),
        }),
      })
    );
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith({
      where: { idempotencyKey: webhookIdempotencyKey("stripe", EVENT_ID, body) },
      data: { processed: true, processedAt: expect.any(Date) },
    });
  });

  it("rejects invalid Stripe signature with 400", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const event = paymentIntentSucceededEvent();
    const res = await POST(stripeWebhookRequest(event, "t=0,v1=invalid_signature"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Webhook signature verification failed/);
    expect(json.error).not.toContain("whsec_");
    expect(json.error).not.toContain("sk_test");
    expect(mockProcessSuccessfulPayment).not.toHaveBeenCalled();
    expect(mockWebhookCreate).not.toHaveBeenCalled();
  });

  it("acknowledges unsupported event types without finalizing payment", async () => {
    const event = unsupportedStripeEvent();
    mockVerifiedEvent(event);
    const res = await POST(stripeWebhookRequest(event));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockProcessSuccessfulPayment).not.toHaveBeenCalled();
  });

  it("rejects payment_intent.succeeded when metadata.orderId is missing", async () => {
    const event = paymentIntentSucceededEvent({ orderId: "" });
    mockVerifiedEvent(event);
    const body = JSON.stringify(event);
    const res = await POST(stripeWebhookRequest(event));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing orderId" });
    expect(mockProcessSuccessfulPayment).not.toHaveBeenCalled();
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith({
      where: { idempotencyKey: webhookIdempotencyKey("stripe", EVENT_ID, body) },
      data: { processed: false, errorMessage: "Missing orderId in metadata" },
    });
  });

  it("returns 500 when PaymentIntent metadata validation fails inside processSuccessfulPayment", async () => {
    mockProcessSuccessfulPayment.mockRejectedValue(
      new Error("Payment does not belong to this order.")
    );

    const event = paymentIntentSucceededEvent();
    const body = JSON.stringify(event);
    const res = await POST(stripeWebhookRequest(event));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Payment does not belong to this order.");
    expect(json.error).not.toContain("sk_test");
    expect(json.error).not.toContain("whsec_");
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith({
      where: { idempotencyKey: webhookIdempotencyKey("stripe", EVENT_ID, body) },
      data: { processed: false, errorMessage: "Payment does not belong to this order." },
    });
  });

  it("returns 500 when PaymentIntent amount validation fails inside processSuccessfulPayment", async () => {
    mockProcessSuccessfulPayment.mockRejectedValue(
      new Error("Payment amount does not match order total.")
    );

    const res = await POST(stripeWebhookRequest(paymentIntentSucceededEvent()));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Payment amount does not match order total.");
    expect(mockProcessSuccessfulPayment).toHaveBeenCalledTimes(1);
  });

  it("does not re-run finalization for duplicate processed webhook deliveries", async () => {
    const event = paymentIntentSucceededEvent();
    mockWebhookFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ processed: true, idempotencyKey: "webhook:stripe:evt" });

    const res1 = await POST(stripeWebhookRequest(event));
    expect(res1.status).toBe(200);
    expect(mockProcessSuccessfulPayment).toHaveBeenCalledTimes(1);

    const res2 = await POST(stripeWebhookRequest(event));
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ received: true });
    expect(mockProcessSuccessfulPayment).toHaveBeenCalledTimes(1);
    expect(mockWebhookCreate).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/webhooks/stripe when not configured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 500 when Stripe webhook secret is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { STRIPE_WEBHOOK_SECRET: undefined },
    }));
    vi.doMock("@/lib/stripe", () => ({
      stripe: { webhooks: { constructEvent: mockConstructEvent } },
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        webhookEvent: {
          findUnique: mockWebhookFindUnique,
          create: mockWebhookCreate,
          updateMany: mockWebhookUpdateMany,
        },
      },
    }));
    vi.doMock("@/services/post-payment.service", () => ({
      processSuccessfulPayment: mockProcessSuccessfulPayment,
    }));
    vi.doMock("@/services/stripe-refund-webhook.service", () => ({
      handleChargeRefundedWebhook: vi.fn(),
      handleStripeRefundWebhookEvent: vi.fn(),
      handleTransferReversedWebhook: vi.fn(),
    }));

    const { POST: PostUnconfigured } = await import("./route");
    mockVerifiedEvent(paymentIntentSucceededEvent());
    const event = paymentIntentSucceededEvent();
    const res = await PostUnconfigured(stripeWebhookRequest(event));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Webhook not configured" });
    expect(mockProcessSuccessfulPayment).not.toHaveBeenCalled();
  });
});
