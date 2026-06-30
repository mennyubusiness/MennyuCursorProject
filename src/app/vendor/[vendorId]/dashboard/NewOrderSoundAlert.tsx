"use client";

import { useEffect, useRef } from "react";
import {
  playVendorOrderAlertSound,
  VENDOR_ORDER_ALERT_REPEAT_MS,
} from "@/lib/vendor-order-alert-sound";

/**
 * Beeps when new order IDs appear in the vendor "New" column and repeats while they remain unaccepted.
 * Client-only; vendor/kitchen scoped.
 */
export function NewOrderSoundAlert({ newOrderIds }: { newOrderIds: string[] }) {
  const prevIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const current = new Set(newOrderIds);
    const prev = prevIdsRef.current;
    prevIdsRef.current = current;

    if (prev === null) return;
    if (current.size === 0) return;

    const hasNew = newOrderIds.some((id) => !prev.has(id));
    if (!hasNew) return;

    playVendorOrderAlertSound();
  }, [newOrderIds]);

  useEffect(() => {
    if (newOrderIds.length === 0) return;
    const id = setInterval(() => {
      playVendorOrderAlertSound();
    }, VENDOR_ORDER_ALERT_REPEAT_MS);
    return () => clearInterval(id);
  }, [newOrderIds.length, newOrderIds.join("|")]);

  return null;
}
