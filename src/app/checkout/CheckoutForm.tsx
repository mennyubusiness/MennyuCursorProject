"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CheckoutProgress } from "./CheckoutProgress";

interface CheckoutFormProps {
  cartId: string;
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  /** IANA timezone used for scheduled pickup (pod or default). */
  pickupTimezoneLabel: string;
  defaultScheduledDate: string;
  defaultScheduledTime: string;
}

type Step = "form" | "payment";

const stripePublishableKey =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")
    : (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const TIP_PRESET_PERCENTAGES = [15, 20, 25] as const;

function tipCentsForPercent(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}

function PaymentStep({
  orderId,
  clientSecret,
  cartId,
  totalWithTip,
  subtotalCents,
  serviceFeeCents,
  tipCents,
  pickupSummaryLine,
  onSuccess,
}: {
  orderId: string;
  clientSecret: string;
  cartId: string;
  totalWithTip: number;
  subtotalCents: number;
  serviceFeeCents: number;
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
      <form onSubmit={handlePay} className="space-y-4">
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
          className="w-full rounded-xl bg-mennyu-primary py-4 text-base font-semibold text-black hover:bg-mennyu-secondary disabled:opacity-50 sm:py-3"
        >
          {loading ? "Processing…" : "Pay and place order"}
        </button>
        {process.env.NODE_ENV === "development" && (
          <p className="text-center text-xs text-stone-400">
            Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
          </p>
        )}
      </form>
    </div>
  );
}

export function CheckoutForm({
  cartId,
  totalCents,
  subtotalCents,
  serviceFeeCents,
  pickupTimezoneLabel,
  defaultScheduledDate,
  defaultScheduledTime,
}: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [paymentData, setPaymentData] = useState<{
    orderId: string;
    clientSecret: string;
    paymentIntentId: string;
  } | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  /** 15 | 20 | 25 when a preset is active; custom otherwise */
  const [tipPresetPercent, setTipPresetPercent] = useState<number | null>(20);
  const defaultTipCents = tipCentsForPercent(subtotalCents, 20);
  const [tipCents, setTipCents] = useState(defaultTipCents);
  const [customTipInput, setCustomTipInput] = useState("");
  const [customTipError, setCustomTipError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupMode, setPickupMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate);
  const [scheduledTime, setScheduledTime] = useState(defaultScheduledTime);
  const [pickupFieldError, setPickupFieldError] = useState<string | null>(null);

  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const totalWithTip = totalCents + tipCents;

  const pickupSummaryLine =
    pickupMode === "asap"
      ? "ASAP"
      : scheduledDate && scheduledTime
        ? `${scheduledDate} ${scheduledTime} (${pickupTimezoneLabel})`
        : "Scheduled";

  const isCustomTipSelected = tipPresetPercent === null;

  useEffect(() => {
    if (tipPresetPercent !== null) {
      setTipCents(tipCentsForPercent(subtotalCents, tipPresetPercent));
    }
  }, [subtotalCents, tipPresetPercent]);

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
    setTipPresetPercent(null);
    setCustomTipError(null);
    const cents = parseCustomTip(value);
    if (cents !== null) setTipCents(cents);
  }

  function handleCustomTipBlur() {
    if (customTipInput.trim() === "") {
      setTipPresetPercent(20);
      setTipCents(tipCentsForPercent(subtotalCents, 20));
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

  function selectPercentPreset(percent: number) {
    setTipPresetPercent(percent);
    setTipCents(tipCentsForPercent(subtotalCents, percent));
    setCustomTipInput("");
    setCustomTipError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPickupFieldError(null);
    if (pickupMode === "scheduled") {
      if (!scheduledDate.trim() || !scheduledTime.trim()) {
        setPickupFieldError("Choose a date and time for pickup.");
        return;
      }
    }
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
          pickupMode,
          ...(pickupMode === "scheduled"
            ? { scheduledPickupDate: scheduledDate, scheduledPickupTime: scheduledTime }
            : {}),
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
          const orderData =
            (orderText &&
              (() => {
                try {
                  return JSON.parse(orderText);
                } catch {
                  return {};
                }
              })()) ?? {};
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
        setError("Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
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
      <Elements stripe={stripePromise} options={{ clientSecret: paymentData.clientSecret }}>
        <PaymentStep
          orderId={paymentData.orderId}
          clientSecret={paymentData.clientSecret}
          cartId={cartId}
          totalWithTip={totalWithTip}
          subtotalCents={subtotalCents}
          serviceFeeCents={serviceFeeCents}
          tipCents={tipCents}
          pickupSummaryLine={pickupSummaryLine}
          onSuccess={() => router.push(`/order/${paymentData!.orderId}`)}
        />
      </Elements>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Contact
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          We&apos;ll text order updates to your phone.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-stone-800">
              Mobile number <span className="text-red-600">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-800">
              Email <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2.5"
              placeholder="you@example.com"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Pickup</h2>
        <p className="mt-1 text-sm text-stone-500">Pickup orders only. Times use {pickupTimezoneLabel}.</p>
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">When to pick up</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 has-[:checked]:border-mennyu-primary has-[:checked]:bg-mennyu-muted">
            <input
              type="radio"
              name="pickupMode"
              checked={pickupMode === "asap"}
              onChange={() => {
                setPickupMode("asap");
                setPickupFieldError(null);
              }}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-stone-900">ASAP</span>
              <span className="mt-0.5 block text-sm text-stone-600">
                As soon as the kitchen can prepare your order (default).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 has-[:checked]:border-mennyu-primary has-[:checked]:bg-mennyu-muted">
            <input
              type="radio"
              name="pickupMode"
              checked={pickupMode === "scheduled"}
              onChange={() => setPickupMode("scheduled")}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-stone-900">Schedule for later</span>
              <span className="mt-0.5 block text-sm text-stone-600">
                Choose when you plan to pick up (at least ~30 minutes from now).
              </span>
              {pickupMode === "scheduled" && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <div>
                    <label htmlFor="pickup-date" className="block text-xs font-medium text-stone-600">
                      Date
                    </label>
                    <input
                      id="pickup-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="pickup-time" className="block text-xs font-medium text-stone-600">
                      Time
                    </label>
                    <input
                      id="pickup-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                    />
                  </div>
                </div>
              )}
            </span>
          </label>
        </fieldset>
        {pickupFieldError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {pickupFieldError}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Tip</h2>
        <p className="mt-1 text-sm text-stone-500">
          Based on food subtotal (${(subtotalCents / 100).toFixed(2)}). Shared across vendors.
        </p>
        <div className="mt-4 flex flex-wrap items-stretch gap-2">
          {TIP_PRESET_PERCENTAGES.map((pct) => {
            const amt = tipCentsForPercent(subtotalCents, pct);
            const selected = tipPresetPercent === pct;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => selectPercentPreset(pct)}
                className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm font-medium sm:flex-none sm:px-4 ${
                  selected
                    ? "border-mennyu-primary bg-mennyu-muted text-stone-900"
                    : "border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <span className="block">{pct}%</span>
                <span className="block text-xs font-normal text-stone-600">
                  (${(amt / 100).toFixed(2)})
                </span>
              </button>
            );
          })}
          <div
            className={`flex min-h-[44px] min-w-[7rem] flex-1 items-center rounded-lg border px-3 sm:flex-none ${
              isCustomTipSelected
                ? "border-mennyu-primary bg-mennyu-muted"
                : "border-stone-300 bg-white"
            }`}
          >
            <span className="pr-2 text-sm text-stone-500">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Other"
              value={customTipInput}
              onChange={handleCustomTipChange}
              onBlur={handleCustomTipBlur}
              onFocus={() => {
                if (tipPresetPercent !== null) {
                  setCustomTipInput((tipCents / 100).toFixed(2));
                }
                setTipPresetPercent(null);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Custom tip in dollars"
            />
          </div>
        </div>
        {customTipError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {customTipError}
          </p>
        )}
      </section>

      <section className="rounded-xl border-2 border-stone-200 bg-stone-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Total before payment
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Food + service fee</dt>
            <dd className="tabular-nums">${(totalCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Tip</dt>
            <dd className="tabular-nums">${(tipCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-bold text-stone-900">
            <dt>Estimated charge</dt>
            <dd className="tabular-nums">${(totalWithTip / 100).toFixed(2)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-stone-500">
          {stripePromise
            ? "Next step: secure card payment with Stripe."
            : "Without Stripe keys, checkout uses the dev payment path."}
        </p>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-mennyu-primary py-4 text-base font-semibold text-black hover:bg-mennyu-secondary disabled:opacity-50"
      >
        {loading ? "Preparing payment…" : "Continue to payment"}
      </button>
    </form>
  );
}
