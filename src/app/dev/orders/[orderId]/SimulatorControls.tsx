"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TARGETS = [
  "sent",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "failed",
] as const;

type Target = (typeof TARGETS)[number];

export function SimulatorControls({
  vendorOrderId,
  currentRouting,
  currentFulfillment,
}: {
  vendorOrderId: string;
  currentRouting: string;
  currentFulfillment: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Target>("confirmed");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dev/simulate-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorOrderId, targetState: target }),
      });
      const text = await res.text();
      const data = (text && (() => { try { return JSON.parse(text); } catch { return {}; } })()) ?? {};
      if (!res.ok) {
        setMessage(data.error ?? "Request failed");
        return;
      }
      setMessage(`→ ${data.routingStatus} / ${data.fulfillmentStatus}. Parent: ${data.parentStatus}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value as Target)}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        {TARGETS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-stone-700 px-3 py-1 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {loading ? "…" : "Apply"}
      </button>
      {message && <span className="text-sm text-stone-600">{message}</span>}
    </form>
  );
}
