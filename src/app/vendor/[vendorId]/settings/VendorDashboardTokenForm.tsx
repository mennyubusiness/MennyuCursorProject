"use client";

import { useState } from "react";
import { bindVendorDashboardSession } from "@/actions/vendor-dashboard.actions";

export function VendorDashboardTokenForm({ vendorId }: { vendorId: string }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await bindVendorDashboardSession(vendorId, token);
      if (res.ok) {
        setMessage({
          text: "Session saved in this browser.",
          ok: true,
        });
        setToken("");
      } else {
        setMessage({ text: res.error ?? "Failed", ok: false });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-stone-800">Manual access token</h4>
      <p className="mt-1 text-xs text-stone-500">
        Same session as an admin secure link — use only when you must paste a token (e.g. API/automation).
      </p>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <label htmlFor="vdash-token" className="sr-only">
          Access token
        </label>
        <input
          id="vdash-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste token"
          className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save session"}
        </button>
      </form>
      {message && (
        <p className={`mt-2 text-sm ${message.ok ? "text-emerald-800" : "text-red-700"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
