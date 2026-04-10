"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;

/**
 * Lightweight freshness for collaborative carts: full RSC refresh on an interval while the tab is visible.
 * No websockets; single-user carts are unaffected (caller passes enabled=false).
 */
export function GroupOrderCartPoll({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return null;
}
