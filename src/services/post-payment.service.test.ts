import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidate = vi.fn();
const mockRecordPayment = vi.fn();
const mockSetOrderStatus = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockSubmitVendorOrder = vi.fn();
const mockClearCart = vi.fn();
const mockSendSms = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
  },
}));

vi.mock("@/services/payment.service", () => ({
  validatePaymentIntentForOrderProcessing: (...args: unknown[]) => mockValidate(...args),
  recordPaymentAndAllocations: (...args: unknown[]) => mockRecordPayment(...args),
}));

vi.mock("@/services/order.service", () => ({
  setOrderStatus: (...args: unknown[]) => mockSetOrderStatus(...args),
}));

vi.mock("@/services/routing.service", () => ({
  submitVendorOrder: (...args: unknown[]) => mockSubmitVendorOrder(...args),
}));

vi.mock("@/services/cart.service", () => ({
  clearCheckoutSourceCartForOrder: (...args: unknown[]) => mockClearCart(...args),
}));

vi.mock("@/services/customer-order-notification.service", () => ({
  sendOrderReceivedMilestone: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  deriveParentStatusFromVendorOrders: vi.fn(() => "routing"),
}));

import { processSuccessfulPayment } from "./post-payment.service";

describe("processSuccessfulPayment validation gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockResolvedValue({ ok: true });
    mockRecordPayment.mockResolvedValue({ created: true });
    mockOrderFindUnique
      .mockResolvedValueOnce({ status: "pending_payment" })
      .mockResolvedValue({
        vendorOrders: [],
        pod: { name: "Pod" },
        customerPhone: "+15551234567",
      });
  });

  it("validates PaymentIntent when order is pending_payment", async () => {
    await processSuccessfulPayment({
      orderId: "ord_1",
      paymentIntentId: "pi_1",
      idempotencyKey: "confirm_1",
    });

    expect(mockValidate).toHaveBeenCalledWith({
      orderId: "ord_1",
      paymentIntentId: "pi_1",
    });
  });

  it("skips validation when order is already past pending_payment", async () => {
    mockOrderFindUnique.mockReset();
    mockOrderFindUnique.mockResolvedValueOnce({ status: "paid" });

    await processSuccessfulPayment({
      orderId: "ord_1",
      paymentIntentId: "pi_1",
      idempotencyKey: "stripe_evt",
    });

    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("throws when validation fails", async () => {
    mockValidate.mockResolvedValue({
      ok: false,
      status: 403,
      code: "PAYMENT_INTENT_METADATA_MISMATCH",
      message: "Payment does not belong to this order.",
    });

    await expect(
      processSuccessfulPayment({
        orderId: "ord_1",
        paymentIntentId: "pi_wrong",
        idempotencyKey: "confirm_1",
      })
    ).rejects.toThrow("Payment does not belong to this order.");

    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it("no-ops replay when order is already past pending_payment", async () => {
    mockOrderFindUnique.mockReset();
    mockOrderFindUnique.mockResolvedValueOnce({ status: "paid" });

    await processSuccessfulPayment({
      orderId: "ord_1",
      paymentIntentId: "pi_1",
      idempotencyKey: "stripe_evt",
    });

    expect(mockValidate).not.toHaveBeenCalled();
    expect(mockRecordPayment).not.toHaveBeenCalled();
    expect(mockSetOrderStatus).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockClearCart).toHaveBeenCalledWith("ord_1");
  });
});
