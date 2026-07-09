"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminSquareStatusSync({ vendorOrderId }: { vendorOrderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleSync() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/square-status-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      const text = data.message ?? data.error ?? (res.ok ? "Done" : "Request failed");
      const err = !res.ok || data.ok === false;
      setMessage({ text, error: err });
      if (res.ok && data.updatedVendorOrderState) router.refresh();
      if (res.ok && data.result === "noop_same_status") router.refresh();
    } catch {
      setMessage({ text: "Network error", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        type="button"
        title="Fetches latest Square order state and applies the same status mapper as webhooks."
        onClick={handleSync}
        disabled={loading}
        className="w-fit rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1 text-xs text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
      >
        {loading ? "…" : "Sync status from Square now"}
      </button>
      {message ? (
        <p className={`text-xs ${message.error ? "text-amber-800" : "text-oo-stone-gray"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
