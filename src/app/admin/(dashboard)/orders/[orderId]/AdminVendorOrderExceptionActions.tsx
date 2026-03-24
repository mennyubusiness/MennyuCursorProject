"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExceptionType } from "@/lib/admin-exceptions";

export function AdminVendorOrderExceptionActions({
  vendorOrderId,
  exceptionType,
  fulfillmentStatus,
  routingAvailable,
  canCancel,
}: {
  vendorOrderId: string;
  exceptionType: ExceptionType;
  /** Used to hide manual recovery button once already recovered (idempotent UI). */
  fulfillmentStatus: string;
  routingAvailable: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const showRetry =
    (exceptionType === "routing_failed" || exceptionType === "routing_stuck") && routingAvailable;
  const canManualRecovery =
    (exceptionType === "routing_failed" || exceptionType === "routing_stuck") &&
    fulfillmentStatus === "pending";
  const alreadyManuallyRecovered =
    (exceptionType === "routing_failed" || exceptionType === "routing_stuck") &&
    fulfillmentStatus !== "pending";

  async function handleRetry() {
    setMessage(null);
    setLoading("retry");
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/retry-routing`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      setMessage({
        text: data.message ?? data.error ?? (res.ok ? "Submitted" : "Failed"),
        error: !res.ok || data.ok === false,
      });
      if (res.ok && data.ok !== false) router.refresh();
    } catch {
      setMessage({ text: "Error", error: true });
    } finally {
      setLoading(null);
    }
  }

  async function handleManualRecovery() {
    setMessage(null);
    setLoading("manual");
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/manual-recovery`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      setMessage({
        text: data.noop ? data.message : (data.message ?? data.error ?? (res.ok ? "Marked manually received" : "Failed")),
        error: !res.ok || data.ok === false,
      });
      if (res.ok && data.ok !== false) router.refresh();
    } catch {
      setMessage({ text: "Error", error: true });
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setMessage(null);
    setLoading("cancel");
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetState: "cancelled" }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage({
        text: data.message ?? data.error ?? (res.ok ? "Cancelled" : "Cancel failed"),
        error: !res.ok || data.ok === false,
      });
      if (res.ok && data.ok !== false) router.refresh();
    } catch {
      setMessage({ text: "Error", error: true });
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showRetry && (
          <button
            type="button"
            title="Try sending the order again through the system."
            onClick={handleRetry}
            disabled={busy}
            className="rounded bg-stone-600 px-2 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {loading === "retry" ? "…" : "Retry routing"}
          </button>
        )}
        {!routingAvailable && (exceptionType === "routing_failed" || exceptionType === "routing_stuck") && (
          <span className="text-xs text-stone-500">Retry unavailable (mock mode)</span>
        )}
        {canManualRecovery && (
          <button
            type="button"
            title="Use when the vendor confirmed offline that they have the order."
            onClick={handleManualRecovery}
            disabled={busy}
            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading === "manual" ? "…" : "Mark manually received"}
          </button>
        )}
        {alreadyManuallyRecovered && (
          <span className="text-xs text-stone-500">Manually recovered</span>
        )}
        {canCancel && (
          <button
            type="button"
            title="Use when this vendor portion cannot be fulfilled."
            onClick={handleCancel}
            disabled={busy}
            className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {loading === "cancel" ? "…" : "Cancel VO"}
          </button>
        )}
      </div>
      {message && (
        <p className={`text-xs ${message.error ? "text-red-600" : "text-stone-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
