"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Collaborative cart freshness: adaptive interval + lightweight fingerprint check before full RSC refresh.
 *
 * - Calls GET /api/cart/group-order-fingerprint with `cartId`; only runs `router.refresh()` when the
 *   fingerprint string changes (joins, leaves, lock, line/modifier edits).
 * - On fetch failure or non-OK response, skips refresh for that cycle (fail closed — no unnecessary SSR).
 * - First successful fingerprint sample seeds `lastFingerprint` without refresh (SSR is already current).
 * - Preserves prior cadence: 8s active / 12s idle (90s without `mennyu:cart-added`), visibility gating.
 */
const POLL_MS_ACTIVE = 8000;
const POLL_MS_IDLE = 12_000;
const IDLE_AFTER_LOCAL_ACTIVITY_MS = 90_000;

export function GroupOrderCartPoll({
  enabled,
  cartId,
}: {
  enabled: boolean;
  /** Required when enabled — collaborative cart id from SSR. */
  cartId: string | null;
}) {
  const router = useRouter();
  const lastLocalActivityRef = useRef<number>(Date.now());
  const lastFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    lastFingerprintRef.current = null;
  }, [cartId]);

  useEffect(() => {
    if (!enabled || !cartId) return;

    const bumpActivity = () => {
      lastLocalActivityRef.current = Date.now();
    };
    window.addEventListener("mennyu:cart-added", bumpActivity);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const idle =
        Date.now() - lastLocalActivityRef.current > IDLE_AFTER_LOCAL_ACTIVITY_MS;
      const delay = idle ? POLL_MS_IDLE : POLL_MS_ACTIVE;
      timeoutId = setTimeout(() => {
        void tick();
      }, delay);
    };

    async function tick() {
      if (cancelled) return;
      const id = cartId;
      if (!id) {
        scheduleNext();
        return;
      }
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        scheduleNext();
        return;
      }

      try {
        const res = await fetch(
          `/api/cart/group-order-fingerprint?cartId=${encodeURIComponent(id)}`,
          { credentials: "same-origin", cache: "no-store" }
        );
        if (!res.ok) {
          scheduleNext();
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        if (data.ok !== true || typeof data.fingerprint !== "string") {
          scheduleNext();
          return;
        }
        const fp = data.fingerprint;
        if (lastFingerprintRef.current === null) {
          lastFingerprintRef.current = fp;
        } else if (fp !== lastFingerprintRef.current) {
          lastFingerprintRef.current = fp;
          router.refresh();
        }
      } catch {
        // network / parse — skip refresh this cycle
      }
      scheduleNext();
    }

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("mennyu:cart-added", bumpActivity);
    };
  }, [enabled, cartId, router]);

  return null;
}
