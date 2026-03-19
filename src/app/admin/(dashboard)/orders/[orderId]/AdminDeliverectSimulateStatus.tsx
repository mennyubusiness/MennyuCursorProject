"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS: { label: string; code: number }[] = [
  { label: "Accepted (20)", code: 20 },
  { label: "Preparing (30)", code: 30 },
  { label: "Ready (50)", code: 50 },
  { label: "Completed (90)", code: 90 },
  { label: "Canceled (110)", code: 110 },
];

/**
 * TEMP: Push test status to Deliverect (triggers webhooks). Admin order page only.
 * Does not mutate Mennyu DB from the client — updates arrive via webhook.
 */
export function AdminDeliverectSimulateStatus({ vendorOrderId }: { vendorOrderId: string }) {
  const router = useRouter();
  const [code, setCode] = useState<number>(OPTIONS[0].code);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleApply() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/simulate-deliverect-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        deliverectStatusCode?: number;
        deliverectResponse?: unknown;
      };
      if (res.ok && data.ok !== false) {
        setMessage({
          text: `Deliverect accepted status ${code} (HTTP ${data.deliverectStatusCode ?? res.status}). Mennyu should update when the webhook arrives — refresh in a moment.`,
          error: false,
        });
        router.refresh();
      } else {
        const detail =
          typeof data.deliverectResponse === "object" && data.deliverectResponse != null
            ? JSON.stringify(data.deliverectResponse).slice(0, 200)
            : String(data.error ?? res.statusText);
        setMessage({
          text: data.error ? `${data.error} (${detail})` : detail || "Request failed",
          error: true,
        });
      }
    } catch {
      setMessage({ text: "Network or unexpected error", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-amber-200 bg-amber-50/60 p-2">
      <p className="text-xs font-medium text-amber-900">Sandbox: send test status to Deliverect</p>
      <p className="mt-0.5 text-xs text-amber-800/90">
        Calls Deliverect&apos;s order status API only. This app does not change the order here — expect updates
        through the Deliverect webhook after a short delay.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={code}
          onChange={(e) => setCode(Number(e.target.value))}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
        >
          {OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleApply}
          disabled={loading}
          className="rounded bg-amber-800 px-2 py-1 text-sm text-white hover:bg-amber-900 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Apply"}
        </button>
      </div>
      {message && (
        <span className={`mt-2 block text-xs ${message.error ? "text-red-700" : "text-stone-700"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
