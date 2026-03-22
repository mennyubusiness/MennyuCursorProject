"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePublishableKey =
  typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "") : "";

function ResumePaymentForm({ orderId, totalCents }: { orderId: string; totalCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
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
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${typeof window !== "undefined" ? window.location.origin : ""}/order/${orderId}?payment=success`,
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
      router.push(`/order/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="mt-6 space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
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
        className="w-full rounded-xl bg-mennyu-primary py-4 text-base font-semibold text-black hover:bg-mennyu-secondary disabled:opacity-50"
      >
        {loading ? "Processing…" : `Pay ${(totalCents / 100).toFixed(2)} USD`}
      </button>
    </form>
  );
}

function DevBypassResume({
  orderId,
  paymentIntentId,
}: {
  orderId: string;
  paymentIntentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentIntentId,
          idempotencyKey: `resume_confirm_${crypto.randomUUID()}`,
        }),
      });
      const text = await res.text();
      const data =
        (text &&
          (() => {
            try {
              return JSON.parse(text);
            } catch {
              return {};
            }
          })()) ??
        {};
      if (!res.ok) {
        setError(data.error ?? "Order confirmation failed");
        return;
      }
      router.push(`/order/${orderId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={loading}
        className="w-full rounded-xl bg-mennyu-primary py-4 text-base font-semibold text-black hover:bg-mennyu-secondary disabled:opacity-50"
      >
        {loading ? "Confirming…" : "Complete test payment (dev)"}
      </button>
    </div>
  );
}

export function OrderResumePaymentClient({
  orderId,
  clientSecret,
  paymentIntentId,
  totalCents,
}: {
  orderId: string;
  clientSecret: string;
  paymentIntentId: string;
  totalCents: number;
}) {
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    []
  );

  if (clientSecret === "dev_bypass") {
    return (
      <div className="rounded-xl border border-stone-200 bg-amber-50/80 p-4 text-sm text-amber-950">
        <p className="font-medium">Development payment bypass</p>
        <p className="mt-1 text-amber-900/90">No Stripe keys — confirm to mark this order paid.</p>
        <DevBypassResume orderId={orderId} paymentIntentId={paymentIntentId} />
        <Link href="/cart" className="mt-4 inline-block text-amber-900 underline hover:no-underline">
          Back to cart
        </Link>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <p className="mt-4 text-sm text-red-600">
        Stripe is not configured. Set <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <ResumePaymentForm orderId={orderId} totalCents={totalCents} />
      <p className="mt-4 text-center text-sm">
        <Link href="/cart" className="text-stone-600 underline hover:text-stone-900">
          Back to cart
        </Link>
      </p>
    </Elements>
  );
}
