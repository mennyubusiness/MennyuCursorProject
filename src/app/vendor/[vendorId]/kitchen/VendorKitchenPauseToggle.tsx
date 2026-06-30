"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { VENDOR_POS_INTAKE_MANAGED_COPY } from "@/lib/vendor-operational-copy";

type Variant = "kitchen" | "orders";

export function VendorKitchenPauseToggle({
  vendorId,
  initialPaused,
  variant = "kitchen",
  posManaged = false,
}: {
  vendorId: string;
  initialPaused: boolean;
  /** `orders`: labels and layout for the Orders workbench toolbar. */
  variant?: Variant;
  /** When true, intake cannot be toggled in Open Order (POS-controlled). */
  posManaged?: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pauseLabel = variant === "orders" ? "Pause order intake" : "Pause intake";
  const resumeLabel = variant === "orders" ? "Resume order intake" : "Resume intake";

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

  if (posManaged && variant === "orders") {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <p className="rounded-xl border border-oo-light-stone bg-oo-cream/80 px-4 py-2.5 text-sm text-oo-stone-gray">
          {VENDOR_POS_INTAKE_MANAGED_COPY}
        </p>
      </div>
    );
  }

  const buttonClass =
    variant === "orders"
      ? `inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
          paused
            ? "bg-amber-100 text-amber-950 hover:bg-amber-200"
            : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
        }`
      : `rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          paused
            ? "bg-amber-100 text-amber-950 hover:bg-amber-200"
            : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
        }`;

  return (
    <div className={`flex flex-col gap-1 ${variant === "orders" ? "items-end text-right" : "items-end"}`}>
      <button type="button" onClick={() => void handleToggle()} disabled={loading} className={buttonClass}>
        {loading ? "…" : paused ? resumeLabel : pauseLabel}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
