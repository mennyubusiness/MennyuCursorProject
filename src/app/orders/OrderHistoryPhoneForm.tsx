"use client";

import { useState } from "react";

export function OrderHistoryPhoneForm() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Enter your phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders/set-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
        redirect: "follow",
      });
      if (res.ok || res.redirected) {
        window.location.href = "/orders";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-white p-6">
      <p className="text-stone-600">
        Enter the phone number used for this order to view your order history.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="rounded border border-stone-300 px-3 py-2 text-stone-900"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-stone-800 px-4 py-2 text-white hover:bg-stone-900 disabled:opacity-50"
        >
          {loading ? "…" : "View orders"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
