"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VendorKitchenPauseToggle({
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          paused
            ? "bg-amber-100 text-amber-950 hover:bg-amber-200"
            : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
        }`}
      >
        {loading ? "…" : paused ? "Resume intake" : "Pause intake"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
