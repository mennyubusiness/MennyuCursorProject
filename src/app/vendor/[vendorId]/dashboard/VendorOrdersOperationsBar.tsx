"use client";

import { VENDOR_POS_MANAGED_COPY } from "@/lib/vendor-operational-copy";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Single operational strip for the vendor orders page: store + Open Order intake in one line,
 * pause/resume as the primary control (avoids duplicating order-intake copy across two cards).
 */
export function VendorOrdersOperationsBar({
  vendorId,
  initialPaused,
  posOpen,
  layout = "default",
  posManaged = false,
}: {
  vendorId: string;
  initialPaused: boolean;
  /** When false, store is closed (from POS). When undefined, not yet connected. */
  posOpen?: boolean;
  /** `compact`: borderless strip for dashboard surfaces. */
  layout?: "default" | "compact";
  /** When true, Open Order pause/resume may be limited because POS controls intake. */
  posManaged?: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeLabel =
    posOpen === undefined ? "Store hours not connected" : posOpen ? "Store open" : "Store closed";
  const orderIntakeLabel = paused ? "Paused on Open Order" : "Accepting orders on Open Order";

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

  const inner = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium text-oo-charcoal">
          {storeLabel}
          <span className="font-normal text-oo-stone-gray"> · </span>
          {orderIntakeLabel}
        </p>
        {layout === "default" && (
          <p className="text-xs text-oo-stone-gray">
            {paused
              ? "New orders through Open Order are blocked. In-progress orders still appear below."
              : "Customers can order from your published menu on Open Order."}
          </p>
        )}
        {layout === "compact" && !posManaged && (
          <p className="text-xs text-oo-stone-gray">
            Pause stops new Open Order orders. In-progress orders still show below.
          </p>
        )}
        {posManaged ? (
          <p className="text-xs text-oo-stone-gray">{VENDOR_POS_MANAGED_COPY}</p>
        ) : null}
      </div>
      {!posManaged ? (
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            paused
              ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
              : "bg-brand text-white hover:bg-brand-hover"
          }`}
        >
          {loading ? "…" : paused ? "Resume orders" : "Pause orders"}
        </button>
      ) : null}
    </div>
  );

  if (layout === "compact") {
    return (
      <div className="py-1">
        {inner}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
      {inner}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
