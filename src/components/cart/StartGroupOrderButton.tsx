"use client";

import { useCallback, useState } from "react";
import { startGroupOrderForPodAction } from "@/actions/group-order.actions";
import { dispatchGroupOrderStartCartSnapshot } from "@/lib/group-order-start-sync";

type Props = {
  podId: string;
  className?: string;
  label?: string;
  onStarted?: () => void;
  onError?: (message: string) => void;
};

export function StartGroupOrderButton({
  podId,
  className,
  label = "Start group order",
  onStarted,
  onError,
}: Props) {
  const [pending, setPending] = useState(false);

  const onClick = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await startGroupOrderForPodAction(podId);
      if (!result.success) {
        onError?.(result.error);
        return;
      }
      dispatchGroupOrderStartCartSnapshot(result.cart);
      onStarted?.();
    } catch {
      onError?.("Could not start group order. Please try again.");
    } finally {
      setPending(false);
    }
  }, [onError, onStarted, pending, podId]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onClick()}
      className={
        className ??
        "rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-60"
      }
    >
      {pending ? "Starting…" : label}
    </button>
  );
}
