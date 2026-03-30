"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateVendorAutoPublishMenus } from "@/actions/vendor-dashboard.actions";

export function VendorAutoPublishToggle({
  vendorId,
  initialAutoPublishMenus,
}: {
  vendorId: string;
  initialAutoPublishMenus: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialAutoPublishMenus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setLoading(true);
    try {
      const next = !on;
      const res = await updateVendorAutoPublishMenus(vendorId, next);
      if (!res.ok) {
        setError(res.error ?? "Failed to update");
        return;
      }
      setOn(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        <strong>Off (recommended):</strong> review menu imports before they go live.{" "}
        <strong>On:</strong> Deliverect webhook imports can publish automatically when checks pass.
      </p>
      <details className="text-sm text-stone-500">
        <summary className="cursor-pointer select-none text-stone-600 hover:text-stone-800">
          More detail
        </summary>
        <p className="mt-2 pl-0 text-xs leading-relaxed">
          Other import sources (e.g. API pull) still need a manual publish. Same safety rules apply as when you
          publish from Menu imports.
        </p>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            on ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-stone-300 bg-white text-stone-800"
          } disabled:opacity-50`}
        >
          {loading ? "Saving…" : on ? "Auto-publish on" : "Auto-publish off"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
