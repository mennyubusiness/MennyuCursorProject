import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockPaymentFindUnique = vi.fn();
const mockPaymentIntentsRetrieve = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: (...args: unknown[]) => mockOrderFindUnique(...args) },
    payment: { findUnique: (...args: unknown[]) => mockPaymentFindUnique(...args) },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: {
      retrieve: (...args: unknown[]) => mockPaymentIntentsRetrieve(...args),
    },
  },
}));

import {
  ORDER_PAYMENT_CURRENCY,
  validatePaymentIntentForOrderProcessing,
} from "./payment.service";

const ORDER_ID = "ord_test1234567890";
const PI_ID = "pi_test_abc";
const TOTAL = 2500;

function pendingOrder(overrides?: Partial<{ totalCents: number; stripePaymentIntentId: string | null }>) {
  return {
    id: ORDER_ID,
    status: "pending_payment",
    totalCents: TOTAL,
    stripePaymentIntentId: PI_ID,
    ...overrides,
  };
}

function succeededPi(overrides?: Partial<{ orderId: string; amount: number; currency: string; status: string }>) {
  return {
    id: PI_ID,
    metadata: { orderId: ORDER_ID },
    amount: TOTAL,
    currency: ORDER_PAYMENT_CURRENCY,
    status: "succeeded",
    ...overrides,
  };
}

describe("validatePaymentIntentForOrderProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    mockPaymentFindUnique.mockResolvedValue(null);
  });

  it("accepts matching succeeded PaymentIntent metadata", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentIntentsRetrieve.mockResolvedValue(succeededPi());

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects mismatched metadata orderId", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededPi({ metadata: { orderId: "ord_other" } } as never)
    );

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("PAYMENT_INTENT_METADATA_MISMATCH");
      expect(r.status).toBe(403);
    }
  });

  it("rejects mismatched amount", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentIntentsRetrieve.mockResolvedValue(succeededPi({ amount: 9999 }));

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYMENT_AMOUNT_MISMATCH");
  });

  it("rejects mismatched currency", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentIntentsRetrieve.mockResolvedValue(succeededPi({ currency: "eur" }));

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYMENT_CURRENCY_MISMATCH");
  });

  it("rejects non-succeeded PaymentIntent status", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentIntentsRetrieve.mockResolvedValue(succeededPi({ status: "requires_payment_method" }));

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYMENT_INTENT_NOT_SUCCEEDED");
  });

  it("rejects PaymentIntent stored on a different order", async () => {
    mockOrderFindUnique.mockResolvedValue(
      pendingOrder({ stripePaymentIntentId: "pi_other" })
    );
    mockPaymentIntentsRetrieve.mockResolvedValue(succeededPi());

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYMENT_INTENT_ORDER_MISMATCH");
  });

  it("allows idempotent replay when Payment already recorded for same order", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentFindUnique.mockResolvedValue({ orderId: ORDER_ID });

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(true);
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
  });

  it("rejects PaymentIntent already linked to another order", async () => {
    mockOrderFindUnique.mockResolvedValue(pendingOrder());
    mockPaymentFindUnique.mockResolvedValue({ orderId: "ord_other" });

    const r = await validatePaymentIntentForOrderProcessing({
      orderId: ORDER_ID,
      paymentIntentId: PI_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYMENT_INTENT_ORDER_MISMATCH");
  });

  describe("dev bypass", () => {
    it("accepts dev_bypass for matching order in non-production", async () => {
      mockOrderFindUnique.mockResolvedValue(
        pendingOrder({ stripePaymentIntentId: `dev_bypass_${ORDER_ID}` })
      );

      const r = await validatePaymentIntentForOrderProcessing({
        orderId: ORDER_ID,
        paymentIntentId: `dev_bypass_${ORDER_ID}`,
      });
      expect(r.ok).toBe(true);
      expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
    });

    it("rejects dev_bypass in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockOrderFindUnique.mockResolvedValue(
        pendingOrder({ stripePaymentIntentId: `dev_bypass_${ORDER_ID}` })
      );

      const r = await validatePaymentIntentForOrderProcessing({
        orderId: ORDER_ID,
        paymentIntentId: `dev_bypass_${ORDER_ID}`,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("DEV_BYPASS_FORBIDDEN");
    });

    it("rejects dev_bypass id for wrong order", async () => {
      mockOrderFindUnique.mockResolvedValue(pendingOrder({ stripePaymentIntentId: null }));

      const r = await validatePaymentIntentForOrderProcessing({
        orderId: ORDER_ID,
        paymentIntentId: "dev_bypass_ord_other",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PAYMENT_INTENT_ORDER_MISMATCH");
    });
  });
});
