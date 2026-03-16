"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface CheckoutFormProps {
  cartId: string;
  podId: string;
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
}

type Step = "form" | "payment";

const stripePublishableKey = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")
  : (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

function PaymentStep({
  orderId,
  clientSecret,
  cartId,
  totalWithTip,
  onSuccess,
}: {
  orderId: string;
  clientSecret: string;
  cartId: string;
  totalWithTip: number;
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
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
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
      await fetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="mt-6 space-y-4">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="text-stone-600">
          Total: ${(totalWithTip / 100).toFixed(2)}
        </p>
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="rounded-lg bg-mennyu-primary px-6 py-2 font-medium text-black hover:bg-mennyu-secondary disabled:opacity-50"
      >
        {loading ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}

export function CheckoutForm({
  cartId,
  podId,
  totalCents,
  subtotalCents,
  serviceFeeCents,
}: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [paymentData, setPaymentData] = useState<{ orderId: string; clientSecret: string; paymentIntentId: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const TIP_PRESETS_CENTS = [200, 500, 1000];
  const [tipCents, setTipCents] = useState(0);
  const [customTipInput, setCustomTipInput] = useState("");
  const [customTipError, setCustomTipError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const totalWithTip = totalCents + tipCents;

  const isCustomTipSelected = !TIP_PRESETS_CENTS.includes(tipCents);

  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    []
  );

  function parseCustomTip(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const dollars = parseFloat(trimmed);
    if (Number.isNaN(dollars) || dollars < 0) return null;
    return Math.round(dollars * 100);
  }

  function handleCustomTipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCustomTipInput(value);
    setCustomTipError(null);
    const cents = parseCustomTip(value);
    if (cents !== null) setTipCents(cents);
  }

  function handleCustomTipBlur() {
    if (customTipInput.trim() === "") {
      setTipCents(0);
      setCustomTipError(null);
      return;
    }
    const cents = parseCustomTip(customTipInput);
    if (cents === null) {
      setCustomTipError("Enter 0 or a positive amount (e.g. 2.50)");
      setTipCents(0);
    } else {
      setCustomTipError(null);
      setTipCents(cents);
      setCustomTipInput(cents === 0 ? "" : (cents / 100).toFixed(2));
    }
  }

  function selectPreset(cents: number) {
    setTipCents(cents);
    setCustomTipInput("");
    setCustomTipError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (customTipError) return;
    if (isCustomTipSelected && customTipInput.trim() !== "") {
      const cents = parseCustomTip(customTipInput);
      if (cents === null) {
        setCustomTipError("Enter 0 or a positive amount (e.g. 2.50)");
        return;
      }
    }
    setLoading(true);
    const idempotencyKey = idempotencyKeyRef.current;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          customerPhone: phone,
          customerEmail: email || undefined,
          tipCents,
          idempotencyKey,
        }),
      });
      const text = await res.text();
      const data = (text && (() => { try { return JSON.parse(text); } catch { return {}; } })()) ?? {};
      if (!res.ok) {
        setError(data.error?.message ?? data.error ?? "Checkout failed");
        return;
      }
      const { orderId, clientSecret, paymentIntentId } = data;
      if (!clientSecret || !orderId) {
        setError(data.error ?? "Missing payment intent");
        return;
      }

      if (clientSecret === "dev_bypass") {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            paymentIntentId,
            idempotencyKey: `confirm_${idempotencyKey}`,
          }),
        });
        const orderText = await orderRes.text();
        if (!orderRes.ok) {
          const orderData = (orderText && (() => { try { return JSON.parse(orderText); } catch { return {}; } })()) ?? {};
          setError(orderData.error ?? "Order confirmation failed");
          return;
        }
        await fetch("/api/cart/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId }),
        });
        router.push(`/order/${orderId}`);
        return;
      }

      if (!stripePromise) {
        setError("Stripe is not configured for payments. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
        return;
      }
      setPaymentData({ orderId, clientSecret, paymentIntentId });
      setStep("payment");
      if (typeof document !== "undefined") {
        document.cookie = `mennyu_checkout=${encodeURIComponent(JSON.stringify({ orderId, cartId }))}; path=/; max-age=3600; SameSite=Lax`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (step === "payment" && paymentData && stripePromise) {
    return (
      <div className="mt-6">
        <p className="text-stone-600">Complete payment for your order.</p>
        <Elements stripe={stripePromise} options={{ clientSecret: paymentData.clientSecret }}>
          <PaymentStep
            orderId={paymentData.orderId}
            clientSecret={paymentData.clientSecret}
            cartId={cartId}
            totalWithTip={totalWithTip}
            onSuccess={() => router.push(`/order/${paymentData!.orderId}`)}
          />
        </Elements>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-700">
          Phone (required for order updates)
        </label>
        <input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2"
          placeholder="+1 555 123 4567"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          Email (optional)
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Tip</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div
            className={`flex shrink-0 rounded-lg border px-3 py-2 ${
              isCustomTipSelected
                ? "border-mennyu-primary bg-mennyu-muted"
                : "border-stone-300 bg-white"
            }`}
          >
            <span className="pr-2 text-sm text-stone-500">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={customTipInput}
              onChange={handleCustomTipChange}
              onBlur={handleCustomTipBlur}
              className="w-20 border-0 bg-transparent p-0 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Custom tip amount (dollars)"
            />
          </div>
          {TIP_PRESETS_CENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectPreset(c)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                !isCustomTipSelected && tipCents === c
                  ? "border-mennyu-primary bg-mennyu-muted text-mennyu-primary"
                  : "border-stone-300 hover:bg-stone-100"
              }`}
            >
              ${(c / 100).toFixed(2)}
            </button>
          ))}
        </div>
        {customTipError && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {customTipError}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="text-stone-600">
          Total: ${(totalWithTip / 100).toFixed(2)} (includes service fee + tip)
        </p>
        <p className="mt-1 text-xs text-stone-500">
          {stripePromise
            ? "Next: enter card details to complete payment (use test card 4242… in test mode)."
            : "Payment is simulated when Stripe is not configured."}
        </p>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-mennyu-primary px-6 py-2 font-medium text-black hover:bg-mennyu-secondary disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place order"}
      </button>
    </form>
  );
}
