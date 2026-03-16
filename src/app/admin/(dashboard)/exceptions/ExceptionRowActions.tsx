"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExceptionType } from "@/lib/admin-exceptions";

export function ExceptionRowActions({
  itemId,
  vendorOrderId,
  orderId,
  exceptionType,
  routingAvailable,
  canCancel,
  onActionSuccess,
  hideViewOrderLink,
}: {
  /** When provided with onActionSuccess, successful action removes this item from the list instead of refreshing. */
  itemId?: string;
  vendorOrderId: string;
  orderId: string;
  exceptionType: ExceptionType;
  routingAvailable: boolean;
  canCancel: boolean;
  onActionSuccess?: (itemId: string) => void;
  /** When true, omit the "View order" link (e.g. when parent card already has order # as main link). */
  hideViewOrderLink?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const showRetry =
    (exceptionType === "routing_failed" || exceptionType === "routing_stuck") && routingAvailable;
  const showManualRecovery =
    exceptionType === "routing_failed" || exceptionType === "routing_stuck";

  async function handleRetry() {
    setMessage(null);
    setLoading("retry");
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/retry-routing`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      const msg = data.message ?? data.error ?? (res.ok ? "Submitted" : "Failed");
      setMessage({ text: msg, error: !res.ok || data.ok === false });
      if (res.ok && data.ok !== false) {
        if (itemId && onActionSuccess) onActionSuccess(itemId);
        else router.refresh();
      }
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
      const msg = data.noop
        ? data.message
        : (data.message ?? data.error ?? (res.ok ? "Marked manually received" : "Failed"));
      setMessage({ text: msg, error: !res.ok || data.ok === false });
      if (res.ok && data.ok !== false) {
        if (itemId && onActionSuccess) onActionSuccess(itemId);
        else router.refresh();
      }
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
      const msg = data.message ?? data.error ?? (res.ok ? "Cancelled" : "Cancel failed");
      setMessage({ text: msg, error: !res.ok || data.ok === false });
      if (res.ok && data.ok !== false) {
        if (itemId && onActionSuccess) onActionSuccess(itemId);
        else router.refresh();
      }
    } catch {
      setMessage({ text: "Error", error: true });
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
        {!hideViewOrderLink && (
          <a
            href={`/admin/orders/${orderId}`}
            className="text-sm text-stone-600 hover:underline"
          >
            View order
          </a>
        )}
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
          <span className="text-xs text-stone-400">Retry unavailable (mock mode)</span>
        )}
        {showManualRecovery && (
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
      {message && (
        <p className={`text-xs ${message.error ? "text-red-600" : "text-stone-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
