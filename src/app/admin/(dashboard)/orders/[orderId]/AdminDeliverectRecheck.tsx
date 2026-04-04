"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Re-check Deliverect (GET order + same apply pipeline as webhook). Shown only when eligible server-side.
 */
export function AdminDeliverectRecheck({
  vendorOrderId,
  onlyIfOverdueDefault,
}: {
  vendorOrderId: string;
  /** When true, request body sends onlyIfOverdue (stricter ops). */
  onlyIfOverdueDefault?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleRecheck() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/deliverect-recheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyIfOverdue: onlyIfOverdueDefault ?? false, allowAfterManualRecovery: false }),
      });
      const data = await res.json().catch(() => ({}));
      const text =
        data.message ??
        data.reason ??
        data.error ??
        (res.ok ? "Done" : "Request failed");
      const err =
        !res.ok ||
        data.ok === false ||
        data.result === "not_eligible" ||
        data.result === "ambiguous" ||
        data.result === "no_match";
      setMessage({ text: `${text}${data.reason ? ` (${data.reason})` : ""}`, error: err });
      if (res.ok && data.result === "success") router.refresh();
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
        title="Fetches order state from Deliverect API (same mapping as webhooks). Use when webhooks are delayed."
        onClick={handleRecheck}
        disabled={loading}
        className="w-fit rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? "…" : "Re-check Deliverect"}
      </button>
      {message && (
        <p className={`text-xs ${message.error ? "text-amber-800" : "text-stone-600"}`}>{message.text}</p>
      )}
    </div>
  );
}
