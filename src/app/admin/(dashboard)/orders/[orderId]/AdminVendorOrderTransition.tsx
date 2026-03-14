"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminVendorOrderTransition({
  vendorOrderId,
  currentRouting,
  currentFulfillment,
  allowedTargets,
}: {
  vendorOrderId: string;
  currentRouting: string;
  currentFulfillment: string;
  /** Only these targets are valid next steps; derived from getAllowedProgressionTargets. */
  allowedTargets: string[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(allowedTargets[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleApply() {
    if (!target) return;
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetState: target }),
      });
      const data = await res.json().catch(() => ({}));
      const msg = data.message ?? data.error ?? (res.ok ? "Applied" : "Failed");
      setMessage({ text: msg, error: !res.ok || data.ok === false });
      if (res.ok && data.ok !== false) router.refresh();
    } catch {
      setMessage({ text: "Error", error: true });
    } finally {
      setLoading(false);
    }
  }

  if (allowedTargets.length === 0) {
    return (
      <div className="mt-2 text-xs text-stone-500">
        Order progression: no valid transitions (terminal state or use exception actions above).
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-stone-200 bg-stone-50/50 p-2">
      <p className="text-xs font-medium text-stone-600">Order progression</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
        >
          {allowedTargets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleApply}
          disabled={loading}
          className="rounded bg-stone-700 px-2 py-1 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? "…" : "Apply"}
        </button>
        <span className="text-xs text-stone-400">
          current: {currentRouting} / {currentFulfillment}
        </span>
      </div>
      {message && (
        <span className={`mt-1 block text-xs ${message.error ? "text-red-600" : "text-stone-600"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
