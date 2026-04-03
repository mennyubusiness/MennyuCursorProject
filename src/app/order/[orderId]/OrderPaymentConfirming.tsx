"use client";

/**
 * Shown after Stripe redirect (?payment=success) when the order is still `pending_payment`
 * (reconcile lag, webhook race, or transient server error). Each tick retries redirect reconcile
 * (same as a full page refresh) then reads order state — read-only GET polling can stay stale
 * or miss the reconcile pass that fixes the order.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pollOrderAfterPaymentAction } from "@/actions/order.actions";

const POLL_MS = 2000;
const MAX_MS = 180_000;

export function OrderPaymentConfirming({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [stuckMessage, setStuckMessage] = useState<string | null>(null);
  const doneRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    startedAtRef.current = Date.now();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollOnce() {
      if (doneRef.current) return;
      try {
        const { order } = await pollOrderAfterPaymentAction(orderId);
        const s = order?.status;
        const keepWaiting = !order || s === "pending_payment";

        if (!keepWaiting) {
          doneRef.current = true;
          if (intervalId) clearInterval(intervalId);
          router.replace(`/order/${orderId}`);
          router.refresh();
          return;
        }
      } catch {
        /* poll again on transient errors */
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
