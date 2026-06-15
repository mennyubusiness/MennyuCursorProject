"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CheckoutProgress } from "./CheckoutProgress";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { MobileCustomerPageShell } from "@/components/mobile/MobileCustomerPageShell";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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
    <MobileCustomerPageShell withBottomActionBar className="pb-2 sm:pb-0">
    <div className="mt-8 space-y-6">
      <CheckoutProgress activeStep={3} />
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
        <h2 className="text-lg font-semibold text-stone-900">Pay securely</h2>
        <p className="mt-2 text-sm text-stone-600">
          Your card is processed by Stripe. Vendors receive this order only after payment succeeds.
        </p>
        <dl className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
          <div className="flex justify-between gap-4 text-stone-800">
            <dt className="text-stone-600">Pickup</dt>
            <dd className="max-w-[65%] text-right text-sm font-medium">{pickupSummaryLine}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Subtotal</dt>
            <dd className="tabular-nums">${(subtotalCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Service fee</dt>
            <dd className="tabular-nums">${(serviceFeeCents / 100).toFixed(2)}</dd>
          </div>
          {taxCents > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Sales tax</dt>
              <dd className="tabular-nums">${(taxCents / 100).toFixed(2)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Tip</dt>
            <dd className="tabular-nums">${(tipCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 text-base font-bold text-stone-900">
            <dt>Total due</dt>
            <dd className="tabular-nums">${(totalWithTip / 100).toFixed(2)}</dd>
          </div>
        </dl>
      </div>
      <form id="checkout-payment-form" onSubmit={handlePay} className="space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
          <PaymentElement options={{ layout: "tabs" }} />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="hidden w-full rounded-xl bg-stone-900 py-4 text-base font-semibold text-white hover:bg-stone-800 disabled:opacity-50 sm:block sm:py-3"
        >
          {loading ? "Processing…" : "Pay and place order"}
        </button>
        {process.env.NODE_ENV === "development" && (
          <p className="hidden text-center text-xs text-stone-400 sm:block">
            Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
          </p>
        )}
      </form>
    </div>
    <MobileBottomActionBar
      primaryLabel={loading ? "Processing…" : "Pay and place order"}
      primaryType="submit"
      form="checkout-payment-form"
      primaryDisabled={!stripe || !elements || loading}
      primaryLoading={loading}
      priceLabel={`$${(totalWithTip / 100).toFixed(2)}`}
      summarySubtitle="Total due now"
      aria-label="Pay and place order"
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
      <p className="mt-8 text-sm text-red-600" role="alert">
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
