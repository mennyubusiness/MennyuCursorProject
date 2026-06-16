import { formatMobileBottomActionSummary } from "@/lib/mobile-customer-ui";

export const CHECKOUT_SECTION_HEADINGS = {
  contact: "Contact",
  orderSummary: "Order summary",
  pickup: "Pickup",
  tip: "Tip",
  review: "Review",
  payment: "Payment",
} as const;

export type CheckoutFormCtaInput = {
  loading: boolean;
  customTipError: string | null;
  smsConsent: boolean;
  phone: string;
  phoneVerified: boolean;
  pickupMode: "asap" | "scheduled";
  scheduledDate: string;
  scheduledTime: string;
  totalWithTipCents: number;
  itemCount: number;
};

export type CheckoutFormCtaState = {
  primaryEnabled: boolean;
  primaryLabel: string;
  summaryTitle: string;
  summarySubtitle: string | null;
  blockedReason: string | null;
};

export function formatCheckoutTotalSummary(totalCents: number): string {
  return `Total · $${(totalCents / 100).toFixed(2)}`;
}

export function resolveCheckoutFormCtaState(input: CheckoutFormCtaInput): CheckoutFormCtaState {
  const summaryTitle = formatCheckoutTotalSummary(input.totalWithTipCents);

  if (input.loading) {
    return {
      primaryEnabled: false,
      primaryLabel: "Preparing payment…",
      summaryTitle,
      summarySubtitle: "Creating your order",
      blockedReason: null,
    };
  }

  if (input.customTipError) {
    return {
      primaryEnabled: false,
      primaryLabel: "Continue to payment",
      summaryTitle,
      summarySubtitle: "Fix tip amount",
      blockedReason: "Fix tip amount",
    };
  }

  if (input.smsConsent && input.phone.trim() && !input.phoneVerified) {
    return {
      primaryEnabled: false,
      primaryLabel: "Continue to payment",
      summaryTitle,
      summarySubtitle: "Verify phone or turn off SMS updates",
      blockedReason: "Verify phone or turn off SMS updates",
    };
  }

  if (
    input.pickupMode === "scheduled" &&
    (!input.scheduledDate.trim() || !input.scheduledTime.trim())
  ) {
    return {
      primaryEnabled: false,
      primaryLabel: "Continue to payment",
      summaryTitle,
      summarySubtitle: "Choose pickup date and time",
      blockedReason: "Choose pickup date and time",
    };
  }

  return {
    primaryEnabled: true,
    primaryLabel: "Continue to payment",
    summaryTitle,
    summarySubtitle: formatMobileBottomActionSummary(input.itemCount, input.totalWithTipCents),
    blockedReason: null,
  };
}

export type CheckoutPaymentCtaInput = {
  loading: boolean;
  stripeReady: boolean;
  totalWithTipCents: number;
};

export type CheckoutPaymentCtaState = {
  primaryEnabled: boolean;
  primaryLabel: string;
  summaryTitle: string;
  summarySubtitle: string | null;
  blockedReason: string | null;
};

export function resolveCheckoutPaymentCtaState(
  input: CheckoutPaymentCtaInput
): CheckoutPaymentCtaState {
  const summaryTitle = formatCheckoutTotalSummary(input.totalWithTipCents);

  if (input.loading) {
    return {
      primaryEnabled: false,
      primaryLabel: "Place order",
      summaryTitle,
      summarySubtitle: "Processing payment…",
      blockedReason: null,
    };
  }

  if (!input.stripeReady) {
    return {
      primaryEnabled: false,
      primaryLabel: "Place order",
      summaryTitle,
      summarySubtitle: "Complete payment details",
      blockedReason: "Complete payment details",
    };
  }

  return {
    primaryEnabled: true,
    primaryLabel: "Place order",
    summaryTitle,
    summarySubtitle: "Secure payment powered by Stripe",
    blockedReason: null,
  };
}
