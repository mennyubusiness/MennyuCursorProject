"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_SIMULATE_DELIVERECT_STATUS_CODES,
  DESTRUCTIVE_DELIVERECT_STATUS_CODES,
  deliverectStatusCodeLabel,
} from "@/lib/admin-simulate-deliverect-status";

export function AdminSimulateDeliverectStatusButton({
  vendorOrderId,
  vendorName,
  disabled,
  disabledReason,
}: {
  vendorOrderId: string;
  vendorName: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [statusCode, setStatusCode] = useState<number>(20);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleApply() {
    const label = deliverectStatusCodeLabel(statusCode);
    if (DESTRUCTIVE_DELIVERECT_STATUS_CODES.has(statusCode)) {
      const ok = window.confirm(
        `Apply simulated Deliverect status ${statusCode} (${label}) for ${vendorName}? This updates kitchen state for QA (no Deliverect API call).`
      );
      if (!ok) return;
    }

    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/vendor-orders/${encodeURIComponent(vendorOrderId)}/simulate-deliverect-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusCode,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        mappedFulfillmentStatus?: string | null;
        outcome?: string;
      };
      if (res.ok && data.ok === true) {
        const mapped = data.mappedFulfillmentStatus ?? data.outcome ?? "applied";
        setMessage({ text: `Deliverect status simulated (${mapped}).` });
        router.refresh();
        return;
      }
      setMessage({
        text: data.error ?? "Simulation failed.",
        error: true,
      });
    } catch {
      setMessage({ text: "Simulation failed.", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={statusCode}
          disabled={loading || disabled}
          onChange={(e) => setStatusCode(Number(e.target.value))}
          className="max-w-[11rem] rounded border border-amber-200 bg-oo-warm-white px-1.5 py-1 text-xs text-oo-charcoal disabled:opacity-50"
          aria-label={`Deliverect status for ${vendorName}`}
        >
          {ADMIN_SIMULATE_DELIVERECT_STATUS_CODES.map((code) => (
            <option key={code} value={code}>
              {deliverectStatusCodeLabel(code)} ({code})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          disabled={loading || disabled}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-[6rem] flex-1 rounded border border-amber-200/80 bg-oo-warm-white px-1.5 py-1 text-xs disabled:opacity-50"
        />
      </div>
      <button
        type="button"
        disabled={loading || disabled}
        title={
          disabled
            ? disabledReason
            : "Dev/staging QA — uses same mapper as Deliverect webhook (no API call)"
        }
        onClick={() => void handleApply()}
        className="rounded border border-amber-400 bg-oo-warm-white px-2.5 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "…" : "Apply simulated Deliverect status"}
      </button>
      {disabled && disabledReason ? (
        <span className="text-[11px] text-oo-stone-gray">{disabledReason}</span>
      ) : null}
      {message ? (
        <span className={`text-[11px] ${message.error ? "text-red-700" : "text-emerald-800"}`}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
