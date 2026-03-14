"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VendorPauseToggle({
  vendorId,
  initialPaused,
}: {
  vendorId: string;
  initialPaused: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-stone-800">Mennyu orders</p>
          <p className="text-xs text-stone-500">
            {paused
              ? "New orders through Mennyu are blocked. In-progress orders still show here."
              : "Customers can place orders for your menu via Mennyu."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            paused
              ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
              : "bg-stone-800 text-white hover:bg-stone-900"
          }`}
        >
          {loading ? "…" : paused ? "Resume" : "Pause"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
