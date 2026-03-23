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
        setMessage({ text: "Session saved. You can publish menu imports from this browser.", ok: true });
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
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Dashboard access token</h3>
      <p className="mt-2 text-sm text-stone-600">
        Paste the token your Mennyu admin generated (one-time via admin API). This stores an http-only cookie so you
        can publish menu drafts from the vendor dashboard in production.
      </p>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <label htmlFor="vdash-token" className="sr-only">
          Dashboard token
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
