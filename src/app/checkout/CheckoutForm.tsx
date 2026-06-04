"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  clearCartOnServerAndNotifyClient,
  rememberCheckoutCartForClientClear,
} from "@/lib/cart-checkout-client";
import { CheckoutPhoneVerification } from "./CheckoutPhoneVerification";

const CheckoutPaymentStep = dynamic(
  () => import("./CheckoutPaymentStep").then((m) => m.CheckoutPaymentStep),
  {
    ssr: false,
    loading: () => (
      <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading secure payment">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-stone-100" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-stone-200" />
      </div>
    ),
  }
);

interface CheckoutFormProps {
  cartId: string;
  podId: string;
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  /** Open Order–computed pickup sales tax from pod rate (0 if none). */
  taxCents: number;
  /** IANA timezone used for scheduled pickup (pod or default). */
  pickupTimezoneLabel: string;
  defaultScheduledDate: string;
  defaultScheduledTime: string;
  isSignedIn?: boolean;
  /** Linked verified phone (E.164) for signed-in customers — skips OTP when checkout phone matches. */
  accountVerifiedPhoneE164?: string | null;
  initialPhone?: string;
}

type Step = "form" | "payment";

function buildOrderStatusPath(
  orderId: string,
  opts?: { accessToken?: string; payment?: "success" }
): string {
  const params = new URLSearchParams();
  if (opts?.accessToken) params.set("access", opts.accessToken);
  if (opts?.payment) params.set("payment", opts.payment);
  const qs = params.toString();
  return qs ? `/order/${orderId}?${qs}` : `/order/${orderId}`;
}

const stripeConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const TIP_PRESET_PERCENTAGES = [15, 20, 25] as const;

function tipCentsForPercent(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}

export function CheckoutForm({
  cartId,
  podId,
  totalCents,
  subtotalCents,
  serviceFeeCents,
  taxCents,
  pickupTimezoneLabel,
  defaultScheduledDate,
  defaultScheduledTime,
  isSignedIn = false,
  accountVerifiedPhoneE164 = null,
  initialPhone = "",
}: CheckoutFormProps) {
  const router = useRouter();
  const accountPhoneReady = Boolean(isSignedIn && accountVerifiedPhoneE164);
  const [step, setStep] = useState<Step>("form");
  const [paymentData, setPaymentData] = useState<{
    orderId: string;
    clientSecret: string;
    paymentIntentId: string;
    orderAccessToken: string;
  } | null>(null);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(accountPhoneReady);
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState<string | null>(
    accountPhoneReady ? accountVerifiedPhoneE164 : null
  );
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
    if (!phoneVerified) {
      setError("Verify your phone for order updates before continuing to payment.");
      return;
    }
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
        credentials: "include",
        body: JSON.stringify({
          cartId,
          customerPhone: verifiedPhoneE164 ?? phone,
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
      const { orderId, clientSecret, paymentIntentId, orderAccessToken } = data;
      if (!clientSecret || !orderId || !orderAccessToken) {
        setError(data.error ?? "Missing payment intent");
        return;
      }

      rememberCheckoutCartForClientClear({ cartId, podId, orderId });

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
        await clearCartOnServerAndNotifyClient({
          cartId,
          podId,
          orderId,
          serverAlreadyCleared: true,
        });
        router.push(buildOrderStatusPath(orderId, { accessToken: orderAccessToken }));
        return;
      }

      setPaymentData({ orderId, clientSecret, paymentIntentId, orderAccessToken });
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

  if (step === "payment" && paymentData) {
    return (
      <CheckoutPaymentStep
        orderId={paymentData.orderId}
        clientSecret={paymentData.clientSecret}
        orderAccessToken={paymentData.orderAccessToken}
        cartId={cartId}
        podId={podId}
        totalWithTip={totalWithTip}
        subtotalCents={subtotalCents}
        serviceFeeCents={serviceFeeCents}
        taxCents={taxCents}
        tipCents={tipCents}
        pickupSummaryLine={pickupSummaryLine}
        onSuccess={() =>
          router.push(
            buildOrderStatusPath(paymentData.orderId, {
              accessToken: paymentData.orderAccessToken,
              payment: "success",
            })
          )
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Contact
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          We&apos;ll use this to send order updates and help you find your order later.
        </p>
        <CheckoutPhoneVerification
          phone={phone}
          onPhoneChange={setPhone}
          phoneVerified={phoneVerified}
          verifiedPhoneE164={verifiedPhoneE164}
          isSignedIn={isSignedIn}
          accountVerifiedPhoneE164={accountVerifiedPhoneE164}
          onVerified={(phoneE164) => {
            setPhoneVerified(true);
            setVerifiedPhoneE164(phoneE164);
          }}
          onResetVerification={() => {
            setPhoneVerified(false);
            setVerifiedPhoneE164(null);
          }}
        />
        <div className="mt-4">
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
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Pickup</h2>
        <p className="mt-1 text-sm text-stone-500">Pickup orders only. Times use {pickupTimezoneLabel}.</p>
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">When to pick up</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50">
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
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50">
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
                    ? "border-stone-900 bg-stone-50 text-stone-900"
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
                ? "border-stone-900 bg-stone-50"
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
          <div className="flex justify-between gap-4 text-stone-800">
            <dt className="text-stone-600">Pickup</dt>
            <dd className="max-w-[65%] text-right text-sm font-medium">{pickupSummaryLine}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Food, service fee{taxCents > 0 ? " & tax" : ""}</dt>
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
          {stripeConfigured
            ? "Next step: secure card payment with Stripe."
            : "Without Stripe keys, checkout uses the dev payment path."}
        </p>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-stone-600">
        After you pay, each vendor receives their part of the order. Pickup timing can vary slightly by
        kitchen.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-stone-900 py-4 text-base font-semibold text-white transition hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.99] disabled:opacity-50"
      >
        {loading ? "Preparing payment…" : "Continue to payment"}
      </button>
    </form>
  );
}
