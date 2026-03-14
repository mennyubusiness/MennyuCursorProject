"use client";

import { useState } from "react";
import { reorderFromOrderAction } from "@/actions/order.actions";

export function ReorderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setMessage(null);
    setLoading(true);
    try {
      const result = await reorderFromOrderAction(orderId);
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not reorder");
        return;
      }
      const { cart, addedCount, skipped } = result;
      const next =
        skipped.length > 0
          ? `/cart?reorder_skipped=${skipped.length}&reorder_added=${addedCount}`
          : "/cart";
      if (skipped.length > 0) {
        setMessage(`${addedCount} item(s) added. ${skipped.length} item(s) could not be added (no longer available).`);
      }
      window.location.href = `/api/orders/set-pod?podId=${encodeURIComponent(cart.podId)}&next=${encodeURIComponent(next)}`;
    } catch {
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white hover:bg-stone-900 disabled:opacity-50"
      >
        {loading ? "…" : "Reorder"}
      </button>
      {message && <p className="mt-1 text-xs text-amber-800">{message}</p>}
    </div>
  );
}
