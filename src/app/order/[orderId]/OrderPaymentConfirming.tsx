"use client";

/**
 * Shown after Stripe redirect (?payment=success) when the order is still `pending_payment`
 * (reconcile lag, webhook race, or transient server error). Polls until backend catches up —
 * never mounts a second Stripe payment form.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 2000;
const MAX_MS = 180_000;

export function OrderPaymentConfirming({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [stuckMessage, setStuckMessage] = useState<string | null>(null);
  const doneRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    // TEMP DEBUG: remove after post-payment flow verification
    console.info("[mennyu:post-payment-debug] OrderPaymentConfirming mounted", { orderId });

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollOnce() {
      if (doneRef.current) return;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        const s = data.status;
        // TEMP DEBUG
        console.info("[mennyu:post-payment-debug] poll /api/orders/.../status", { orderId, status: s });

        if (s && s !== "pending_payment") {
          doneRef.current = true;
          if (intervalId) clearInterval(intervalId);
          router.replace(`/order/${orderId}`);
          router.refresh();
          return;
        }
      } catch {
        // ignore transient network errors
      }

      if (Date.now() - startedAtRef.current > MAX_MS) {
        doneRef.current = true;
        if (intervalId) clearInterval(intervalId);
        setStuckMessage("Payment is still confirming. Try refreshing this page in a moment.");
      }
    }

    void pollOnce();
    intervalId = setInterval(() => void pollOnce(), POLL_MS);

    return () => {
      doneRef.current = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div
        className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-stone-300 border-t-mennyu-primary"
        aria-hidden
      />
      <h1 className="text-xl font-semibold text-stone-900">Confirming your payment</h1>
      <p className="mt-2 text-sm text-stone-600">Hang tight — we&apos;re updating your order.</p>
      {stuckMessage && (
        <p className="mt-4 text-sm text-amber-900" role="status">
          {stuckMessage}
        </p>
      )}
    </div>
  );
}
