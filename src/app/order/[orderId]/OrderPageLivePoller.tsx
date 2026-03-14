"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getOrderStatusAction } from "@/actions/order.actions";
import { isTerminalStatus } from "@/domain/order-state";

const POLL_INTERVAL_MS = 8000;

/**
 * Polls order status while the order is active and the tab is visible.
 * When the order reaches a terminal state, refreshes once and stops.
 * Renders nothing.
 */
export function OrderPageLivePoller({
  orderId,
  initialDerivedStatus,
}: {
  orderId: string;
  initialDerivedStatus: string;
}) {
  const router = useRouter();
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isTerminalStatus(initialDerivedStatus as Parameters<typeof isTerminalStatus>[0])) {
      return;
    }

    function clearPoll() {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }

    async function poll() {
      try {
        const order = await getOrderStatusAction(orderId);
        if (!order?.derivedStatus) return;
        if (isTerminalStatus(order.derivedStatus as Parameters<typeof isTerminalStatus>[0])) {
          clearPoll();
          router.refresh();
          return;
        }
        router.refresh();
      } catch {
        // ignore
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!intervalIdRef.current) {
          intervalIdRef.current = setInterval(poll, POLL_INTERVAL_MS);
        }
      } else {
        clearPoll();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") {
      intervalIdRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearPoll();
    };
  }, [orderId, initialDerivedStatus, router]);

  return null;
}
