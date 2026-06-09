"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;

type Props = {
  enabled: boolean;
  cartId: string | null;
  initialSessionStatus: string;
  initialSubmittedOrderId: string | null;
};

/**
 * Polls submission status while participant watches group cart during host checkout.
 * On submitted + order id → router.replace to participant tracking (no stale cart on back).
 */
export function GroupOrderSubmittedRedirect({
  enabled,
  cartId,
  initialSessionStatus,
  initialSubmittedOrderId,
}: Props) {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [awaitingOrder, setAwaitingOrder] = useState(
    () => initialSessionStatus === "submitted" && !initialSubmittedOrderId
  );

  useEffect(() => {
    if (initialSessionStatus === "submitted" && initialSubmittedOrderId && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(`/order/${initialSubmittedOrderId}`);
    }
  }, [initialSessionStatus, initialSubmittedOrderId, router]);

  useEffect(() => {
    if (!enabled || !cartId || redirectedRef.current) return;
    const pollCartId = cartId;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        void tick();
      }, POLL_MS);
    };

    async function tick() {
      if (cancelled || redirectedRef.current) return;
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        scheduleNext();
        return;
      }

      try {
        const res = await fetch(
          `/api/cart/group-order-submission-status?cartId=${encodeURIComponent(pollCartId)}`,
          { credentials: "same-origin", cache: "no-store" }
        );
        if (!res.ok) {
          scheduleNext();
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          sessionStatus?: string;
          submittedOrderId?: string | null;
        };
        if (data.ok !== true || typeof data.sessionStatus !== "string") {
          scheduleNext();
          return;
        }

        if (data.sessionStatus === "submitted") {
          if (data.submittedOrderId) {
            redirectedRef.current = true;
            setAwaitingOrder(false);
            router.replace(`/order/${data.submittedOrderId}`);
            return;
          }
          setAwaitingOrder(true);
        } else {
          setAwaitingOrder(false);
        }
      } catch {
        // skip cycle
      }
      scheduleNext();
    }

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, cartId, router]);

  if (!awaitingOrder) return null;

  return (
    <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950" role="status">
      The host placed the group order. Preparing tracking…
    </p>
  );
}
