"use client";

import { useState } from "react";
import { bindVendorDashboardSession } from "@/actions/vendor-dashboard.actions";

/** Binds the long-lived API access key to an httpOnly dashboard cookie — technical / edge-case only. */
export function VendorDashboardTokenForm({ vendorId }: { vendorId: string }) {
  const [keyValue, setKeyValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await bindVendorDashboardSession(vendorId, keyValue);
      if (res.ok) {
        setMessage({
          text: "Browser session updated for this vendor.",
          ok: true,
        });
        setKeyValue("");
      } else {
        setMessage({ text: res.error ?? "Failed", ok: false });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="vdash-api-key" className="sr-only">
        API access key
      </label>
      <input
        id="vdash-api-key"
        type="password"
        autoComplete="off"
        value={keyValue}
        onChange={(e) => setKeyValue(e.target.value)}
        placeholder="Paste API access key"
        className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
      />
      <button
        type="submit"
        disabled={loading || !keyValue.trim()}
        className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving…" : "Bind session in this browser"}
      </button>
      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-800" : "text-red-700"}`} role="status">
          {message.text}
        </p>
      )}
    </form>
  );
}
