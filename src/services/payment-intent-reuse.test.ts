import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockOrderUpdate = vi.fn();
const mockPaymentIntentsCreate = vi.fn();
const mockPaymentIntentsRetrieve = vi.fn();
const mockPaymentIntentsUpdate = vi.fn();
const mockPaymentIntentsCancel = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: {
      create: (...args: unknown[]) => mockPaymentIntentsCreate(...args),
      retrieve: (...args: unknown[]) => mockPaymentIntentsRetrieve(...args),
      update: (...args: unknown[]) => mockPaymentIntentsUpdate(...args),
      cancel: (...args: unknown[]) => mockPaymentIntentsCancel(...args),
    },
  },
}));

import {
  createPaymentIntent,
  isReusablePaymentIntentStatus,
  resolveExistingOrderPaymentIntent,
  type StripePaymentIntentLike,
} from "./payment.service";

const ORDER_ID = "ord_test1234567890";
const PI_ID = "pi_existing";
const TOTAL = 2500;

function pi(overrides: Partial<StripePaymentIntentLike>): StripePaymentIntentLike {
  return {
    id: PI_ID,
    client_secret: "pi_secret_existing",
    amount: TOTAL,
    currency: "usd",
    status: "requires_payment_method",
    metadata: { orderId: ORDER_ID },
    ...overrides,
  };
}

describe("isReusablePaymentIntentStatus", () => {
  it("includes active payable statuses", () => {
    expect(isReusablePaymentIntentStatus("requires_payment_method")).toBe(true);
    expect(isReusablePaymentIntentStatus("processing")).toBe(true);
    expect(isReusablePaymentIntentStatus("succeeded")).toBe(false);
    expect(isReusablePaymentIntentStatus("canceled")).toBe(false);
  });
});

describe("resolveExistingOrderPaymentIntent", () => {
  const retrieve = vi.fn();
  const update = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockImplementation(async (id, data) => ({
      ...pi({ id }),
      amount: data.amount,
      currency: data.currency,
      metadata: data.metadata,
    }));
    cancel.mockResolvedValue({});
  });

  it("reuses matching PI when amount and currency unchanged", async () => {
    retrieve.mockResolvedValue(pi({}));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r).toEqual({ clientSecret: "pi_secret_existing", paymentIntentId: PI_ID });
    expect(update).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("updates amount when reusable PI amount differs", async () => {
    retrieve.mockResolvedValue(pi({ amount: 2000 }));
    update.mockResolvedValue(pi({ amount: TOTAL }));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r?.paymentIntentId).toBe(PI_ID);
    expect(update).toHaveBeenCalledWith(PI_ID, {
      amount: TOTAL,
      currency: "usd",
      metadata: { orderId: ORDER_ID },
    });
  });

  it("returns succeeded PI without creating a replacement", async () => {
    retrieve.mockResolvedValue(pi({ status: "succeeded", client_secret: null }));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r).toEqual({ clientSecret: "", paymentIntentId: PI_ID });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("returns null for canceled PI", async () => {
    retrieve.mockResolvedValue(pi({ status: "canceled" }));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r).toBeNull();
  });

  it("cancels and returns null when metadata orderId mismatches", async () => {
    retrieve.mockResolvedValue(pi({ metadata: { orderId: "ord_other" } }));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r).toBeNull();
    expect(cancel).toHaveBeenCalledWith(PI_ID);
  });

  it("cancels and returns null when currency mismatches", async () => {
    retrieve.mockResolvedValue(pi({ currency: "eur" }));

    const r = await resolveExistingOrderPaymentIntent({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
      amountCents: TOTAL,
      retrieve,
      update,
      cancel,
    });

    expect(r).toBeNull();
    expect(cancel).toHaveBeenCalledWith(PI_ID);
  });
});

describe("createPaymentIntent checkout retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_real_key");
    mockOrderUpdate.mockResolvedValue({});
    mockPaymentIntentsCancel.mockResolvedValue({});
  });

  it("reuses existing PI on retry without creating a second one", async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: "pending_payment",
      totalCents: TOTAL,
      stripePaymentIntentId: PI_ID,
    });
    mockPaymentIntentsRetrieve.mockResolvedValue(pi({}));

    const r = await createPaymentIntent(ORDER_ID, TOTAL, "client_key_1");

    expect(r).toEqual({ clientSecret: "pi_secret_existing", paymentIntentId: PI_ID });
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
  });

  it("does not replace succeeded PI", async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: "pending_payment",
      totalCents: TOTAL,
      stripePaymentIntentId: PI_ID,
    });
    mockPaymentIntentsRetrieve.mockResolvedValue(
      pi({ status: "succeeded", client_secret: "pi_secret_done" })
    );

    const r = await createPaymentIntent(ORDER_ID, TOTAL, "client_key_1");

    expect(r.paymentIntentId).toBe(PI_ID);
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
  });

  it("cancels unusable PI and creates a replacement", async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: "pending_payment",
      totalCents: TOTAL,
      stripePaymentIntentId: PI_ID,
    });
    mockPaymentIntentsRetrieve.mockResolvedValue(pi({ status: "canceled" }));
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_new",
      client_secret: "pi_secret_new",
    });

    const r = await createPaymentIntent(ORDER_ID, TOTAL, "client_key_1");

    expect(r.paymentIntentId).toBe("pi_new");
    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { stripePaymentIntentId: "pi_new" },
    });
  });

  it("creates first PI when order has none", async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: "pending_payment",
      totalCents: TOTAL,
      stripePaymentIntentId: null,
    });
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_new",
      client_secret: "pi_secret_new",
    });

    const r = await createPaymentIntent(ORDER_ID, TOTAL, "client_key_1");

    expect(r.paymentIntentId).toBe("pi_new");
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: TOTAL,
        currency: "usd",
        metadata: { orderId: ORDER_ID },
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining(ORDER_ID),
      })
    );
  });
});
