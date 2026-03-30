"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Single operational strip for the vendor orders page: store + Mennyu status in one line,
 * pause/resume as the primary control (avoids duplicating "Mennyu orders" across two cards).
 */
export function VendorOrdersOperationsBar({
  vendorId,
  initialPaused,
  posOpen,
}: {
  vendorId: string;
  initialPaused: boolean;
  /** When false, store is closed (from POS). When undefined, not yet connected. */
  posOpen?: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeLabel =
    posOpen === undefined ? "POS not connected" : posOpen ? "Store open (POS)" : "Store closed (POS)";
  const mennyuLabel = paused ? "Mennyu orders paused" : "Mennyu orders active";

  async function handleToggle() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/${vendorId}/pause`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !paused }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setPaused(Boolean(data.paused));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-medium text-stone-900">
            {storeLabel}
            <span className="font-normal text-stone-400"> · </span>
            {mennyuLabel}
          </p>
          <p className="text-xs text-stone-500">
            {paused
              ? "New Mennyu orders are blocked. In-progress orders still appear below."
              : "Customers can order from your published menu on Mennyu."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            paused
              ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
              : "bg-stone-800 text-white hover:bg-stone-900"
          }`}
        >
          {loading ? "…" : paused ? "Resume Mennyu orders" : "Pause Mennyu orders"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
