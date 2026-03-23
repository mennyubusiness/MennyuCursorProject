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
          text: "Session saved in this browser. You can publish menu imports and change auto-publish here.",
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
    <details className="rounded-lg border border-stone-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-stone-500">
        Manual dashboard token (advanced)
      </summary>
      <p className="mt-2 text-sm text-stone-600">
        Prefer the <strong>secure access link</strong> from your admin — no copy/paste. Use this only if you are
        integrating via API or automation that needs the raw secret; it sets the same browser session as the link.
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
    </details>
  );
}
