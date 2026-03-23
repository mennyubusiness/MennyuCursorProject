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
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Menu publishing</h3>
      <p className="mt-2 text-sm text-stone-600">
        <strong>Review before publish (default):</strong> Deliverect sends drafts to Mennyu; you open{" "}
        <strong>Menu imports</strong>, review the diff, then publish.{" "}
        <strong>Auto-publish:</strong> when on, <em>only</em> Deliverect <strong>menu webhook</strong> imports can go
        live automatically if they pass the same safety checks as manual publish (no blocking issues, valid draft).
        Other sources (e.g. API pull) stay in &quot;needs review&quot; until you publish.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            on ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-stone-300 bg-white text-stone-800"
          } disabled:opacity-50`}
        >
          {loading ? "Saving…" : on ? "Auto-publish: ON" : "Auto-publish: OFF (review first)"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
