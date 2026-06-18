import { describe, expect, it } from "vitest";
import {
  CHECKOUT_SECTION_HEADINGS,
  formatCheckoutTotalSummary,
  resolveCheckoutFormCtaState,
  resolveCheckoutPaymentCtaState,
} from "@/lib/checkout-place-order-cta-state";

describe("formatCheckoutTotalSummary", () => {
  it("formats total label for checkout summary", () => {
    expect(formatCheckoutTotalSummary(4218)).toBe("Total · $42.18");
  });
});

describe("resolveCheckoutFormCtaState", () => {
  const base = {
    loading: false,
    customTipError: null,
    smsConsent: false,
    phone: "",
    phoneVerified: false,
    pickupMode: "asap" as const,
    scheduledDate: "2026-06-04",
    scheduledTime: "12:00",
    totalWithTipCents: 4218,
    itemCount: 3,
  };

  it("enables continue when checkout details are valid", () => {
    const state = resolveCheckoutFormCtaState(base);
    expect(state.primaryEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Continue to payment");
    expect(state.summaryTitle).toBe("Total · $42.18");
  });

  it("allows continue when SMS is unchecked and contact fields are empty", () => {
    const state = resolveCheckoutFormCtaState(base);
    expect(state.primaryEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Continue to payment");
  });

  it("blocks when SMS consent requires verification", () => {
    const state = resolveCheckoutFormCtaState({
      ...base,
      smsConsent: true,
      phone: "5551234567",
      phoneVerified: false,
    });
    expect(state.primaryEnabled).toBe(false);
    expect(state.blockedReason).toBe("Verify phone or turn off SMS updates");
  });

  it("blocks when scheduled pickup is incomplete", () => {
    const state = resolveCheckoutFormCtaState({
      ...base,
      pickupMode: "scheduled",
      scheduledDate: "",
      scheduledTime: "",
    });
    expect(state.primaryEnabled).toBe(false);
    expect(state.blockedReason).toBe("Choose pickup date and time");
  });
});

describe("resolveCheckoutPaymentCtaState", () => {
  it("shows place order when Stripe is ready", () => {
    const state = resolveCheckoutPaymentCtaState({
      loading: false,
      stripeReady: true,
      totalWithTipCents: 5000,
    });
    expect(state.primaryEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Place order");
    expect(state.summaryTitle).toBe("Total · $50.00");
  });

  it("blocks with payment details reason when Stripe is not ready", () => {
    const state = resolveCheckoutPaymentCtaState({
      loading: false,
      stripeReady: false,
      totalWithTipCents: 5000,
    });
    expect(state.primaryEnabled).toBe(false);
    expect(state.blockedReason).toBe("Complete payment details");
  });
});

describe("CHECKOUT_SECTION_HEADINGS", () => {
  it("defines guided checkout sections", () => {
    expect(CHECKOUT_SECTION_HEADINGS.contact).toBe("Contact");
    expect(CHECKOUT_SECTION_HEADINGS.orderSummary).toBe("Order summary");
    expect(CHECKOUT_SECTION_HEADINGS.payment).toBe("Payment");
    expect(CHECKOUT_SECTION_HEADINGS.review).toBe("Review");
  });
});
