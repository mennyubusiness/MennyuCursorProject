"use client";

import Link from "next/link";
import { vendorSettingsSectionHref } from "@/lib/vendor-settings-sections";
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
}: {
  vendorId: string;
  initialPaused: boolean;
  /** When false, store is closed (from POS). When undefined, not yet connected. */
  posOpen?: boolean;
  /** `compact`: borderless strip for Orders hub. */
  layout?: "default" | "compact";
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeLabel =
    posOpen === undefined ? "POS not connected" : posOpen ? "Store open (POS)" : "Store closed (POS)";
  const orderIntakeLabel = paused ? "Open Order intake paused" : "Open Order intake active";

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
        {layout === "compact" && (
          <p className="text-xs text-oo-stone-gray">
            Pause or resume from here, or use{" "}
            <Link
              href={vendorSettingsSectionHref(vendorId, "ordering")}
              className="underline hover:text-oo-charcoal"
            >
              Settings
            </Link>
            .
          </p>
        )}
      </div>
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
        {loading ? "…" : paused ? "Resume Open Order intake" : "Pause Open Order intake"}
      </button>
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
