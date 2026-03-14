"use client";

import { useEffect, useRef } from "react";

/**
 * Optional: play a short beep when new order IDs appear (e.g. after refresh).
 * Client-only; no backend. Only runs when newOrderIds length or content changes and we had a previous set.
 */
export function NewOrderSoundAlert({ newOrderIds }: { newOrderIds: string[] }) {
  const prevIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const current = new Set(newOrderIds);
    const prev = prevIdsRef.current;
    prevIdsRef.current = current;

    if (prev === null) return; // first mount: don't beep
    if (current.size === 0) return;

    const hasNew = newOrderIds.some((id) => !prev.has(id));
    if (!hasNew) return;

    try {
      const Ctx = typeof window !== "undefined" ? window.AudioContext : null;
      const ctx = Ctx ? new Ctx() : null;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }, [newOrderIds]);

  return null;
}
