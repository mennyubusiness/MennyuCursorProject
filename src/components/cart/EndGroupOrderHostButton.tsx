"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { endGroupOrderHostAction } from "@/actions/group-order.actions";
import { dispatchGroupOrderEndCartSnapshot } from "@/lib/group-order-end-sync";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";

type Props = {
  cartId: string;
  className?: string;
};

export function EndGroupOrderHostButton({ cartId, className }: Props) {
  const router = useRouter();
  const quickCart = useQuickCartOptional();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await endGroupOrderHostAction(cartId);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      dispatchGroupOrderEndCartSnapshot(result.cart, {
        endedSessionId: result.endedSessionId,
      });
      quickCart?.closeCart();
      setMessage("Group order ended.");
      router.refresh();
    } catch {
      setMessage("Could not end group order. Please try again.");
    } finally {
      setPending(false);
    }
  }, [cartId, pending, quickCart, router]);

  return (
    <div className="shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onClick()}
        className={
          className ??
          "rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
        }
      >
        {pending ? "Ending…" : "End group order"}
      </button>
      {message ? (
        <p className="mt-1 text-[11px] text-stone-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
