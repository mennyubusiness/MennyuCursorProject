"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminAccessDeniedPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
        redirect: "follow",
      });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Access denied");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-stone-900">Admin access</h1>
      <p className="text-sm text-stone-600">
        Enter the admin secret to continue. (In development, access is automatic.)
      </p>
      <p className="text-sm text-stone-600">
        If you have a platform admin account, you can also{" "}
        <Link href="/login?intent=admin" className="font-medium text-sky-800 underline">
          sign in with email
        </Link>{" "}
        (Mennyu team access).
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin secret"
          className="w-full rounded border border-stone-300 px-3 py-2 text-stone-900"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-stone-800 py-2 text-white hover:bg-stone-900 disabled:opacity-50"
        >
          {loading ? "…" : "Continue"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
