"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CheckoutProgress } from "./CheckoutProgress";
import { CheckoutSectionCard } from "@/components/checkout/CheckoutSectionCard";
import { buttonClassName } from "@/components/ui/button";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { MobileCustomerPageShell } from "@/components/mobile/MobileCustomerPageShell";
import { cn } from "@/lib/cn";
import {
  CHECKOUT_SECTION_HEADINGS,
  resolveCheckoutPaymentCtaState,
} from "@/lib/checkout-place-order-cta-state";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const PAYMENT_ELEMENT_MIN_HEIGHT_CLASS = "min-h-[13rem]";

function PaymentStepForm({
  orderId,
  clientSecret,
  orderAccessToken,
  cartId,
  podId,
  totalWithTip,
  subtotalCents,
  serviceFeeCents,
  taxCents,
  tipCents,
  pickupSummaryLine,
  onSuccess,
}: {
  orderId: string;
  clientSecret: string;
  orderAccessToken: string;
  cartId: string;
  podId: string;
  totalWithTip: number;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  tipCents: number;
  pickupSummaryLine: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentCta = resolveCheckoutPaymentCtaState({
    loading,
    stripeReady: Boolean(stripe && elements),
    totalWithTipCents: totalWithTip,
  });

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Validation failed");
        setLoading(false);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const returnParams = new URLSearchParams({
        payment: "success",
        access: orderAccessToken,
      });
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${origin}/order/${orderId}?${returnParams.toString()}`,
          payment_method_data: {
            billing_details: { address: { country: "US" } },
          },
        },
      });
      if (confirmError) {
        setError(confirmError.message ?? "Payment failed");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileCustomerPageShell withBottomActionBar className="bg-oo-cream px-1 pb-2 sm:bg-transparent sm:px-0 sm:pb-0">
      <div className="mx-auto max-w-2xl">
        <CheckoutProgress activeStep={3} />
        <header className="border-b border-oo-light-stone pb-4">
          <h1 className="text-2xl font-bold text-oo-charcoal">Payment</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-oo-stone-gray sm:text-base">
            Review your total and pay securely to place your order.
          </p>
        </header>

        <div className="mt-6 space-y-5 sm:space-y-6">
          <CheckoutSectionCard
            id="checkout-payment-review"
            title={CHECKOUT_SECTION_HEADINGS.review}
            helper="Confirm pickup time and total before placing your order."
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 text-oo-charcoal">
                <dt className="text-oo-stone-gray">Pickup</dt>
                <dd className="max-w-[65%] text-right font-medium">{pickupSummaryLine}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Subtotal</dt>
                <dd className="tabular-nums text-oo-charcoal">${(subtotalCents / 100).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Service fee</dt>
                <dd className="tabular-nums text-oo-charcoal">
                  ${(serviceFeeCents / 100).toFixed(2)}
                </dd>
              </div>
              {taxCents > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-oo-stone-gray">Sales tax</dt>
                  <dd className="tabular-nums text-oo-charcoal">${(taxCents / 100).toFixed(2)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Tip</dt>
                <dd className="tabular-nums text-oo-charcoal">${(tipCents / 100).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-oo-light-stone pt-2 text-lg font-bold text-oo-charcoal">
                <dt>Total due</dt>
                <dd className="tabular-nums">${(totalWithTip / 100).toFixed(2)}</dd>
              </div>
            </dl>
          </CheckoutSectionCard>

          <form id="checkout-payment-form" onSubmit={handlePay} className="space-y-4">
            <CheckoutSectionCard
              id="checkout-payment"
              title={CHECKOUT_SECTION_HEADINGS.payment}
              helper="Secure payment powered by Stripe."
              status={error ? "error" : "default"}
            >
              <div className={cn(PAYMENT_ELEMENT_MIN_HEIGHT_CLASS, "rounded-lg bg-oo-warm-white")}>
                <PaymentElement options={{ layout: "tabs" }} />
              </div>
              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800" role="alert">
                  {error}
                </p>
              ) : null}
            </CheckoutSectionCard>

            <button
              type="submit"
              disabled={!paymentCta.primaryEnabled}
              className={cn(
                buttonClassName({ variant: "primary", size: "touch" }),
                "hidden w-full sm:inline-flex"
              )}
            >
              {paymentCta.primaryLabel}
            </button>
            {process.env.NODE_ENV === "development" ? (
              <p className="hidden text-center text-xs text-oo-stone-gray sm:block">
                Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
              </p>
            ) : null}
          </form>
        </div>
      </div>

      <MobileBottomActionBar
        summaryTitle={paymentCta.summaryTitle}
        summarySubtitle={paymentCta.summarySubtitle ?? undefined}
        primaryLabel={paymentCta.primaryLabel}
        primaryType="submit"
        form="checkout-payment-form"
        primaryDisabled={!paymentCta.primaryEnabled}
        primaryLoading={loading}
        aria-label={paymentCta.blockedReason ?? paymentCta.primaryLabel}
      />
    </MobileCustomerPageShell>
  );
}

export interface CheckoutPaymentStepProps {
  orderId: string;
  clientSecret: string;
  orderAccessToken: string;
  cartId: string;
  podId: string;
  totalWithTip: number;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  tipCents: number;
  pickupSummaryLine: string;
  onSuccess: () => void;
}

/** Loaded dynamically from CheckoutForm so Stripe.js is not fetched on initial checkout mount. */
export function CheckoutPaymentStep(props: CheckoutPaymentStepProps) {
  if (!stripePromise) {
    return (
      <p className="mt-8 text-sm text-red-700" role="alert">
        Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <PaymentStepForm {...props} />
    </Elements>
  );
}
