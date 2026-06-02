"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminSimulateRoutingFailureButton({
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        `Simulate routing failure for ${vendorName}? This marks the vendor order as failed for QA (no Deliverect call).`
      )
    ) {
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/vendor-orders/${encodeURIComponent(vendorOrderId)}/simulate-routing-failure`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok === true) {
        setMessage({ text: "Routing failure simulated." });
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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={loading || disabled}
        title={disabled ? disabledReason : "Dev/staging QA only — does not call Deliverect"}
        onClick={() => void handleClick()}
        className="rounded border border-red-300 bg-oo-warm-white px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "…" : "Simulate routing failure"}
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
