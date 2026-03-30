"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { AdminAttentionItem } from "@/lib/admin-attention";

/** Extract RefundAttempt id from attention item id for refund_failed items (format: refund_attempt:${ra.id}). */
function getRefundAttemptIdFromItemId(itemId: string): string | null {
  if (!itemId.startsWith("refund_attempt:")) return null;
  return itemId.slice("refund_attempt:".length) || null;
}

function severityToUrgencyLabel(severity: AdminAttentionItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
    case "medium":
      return "Stuck";
    default:
      return "New";
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/** Compact age for queue scan: 8m, 1h 05m, 4h 15m, 2d 3h */
function formatAgeCompact(ageMinutes: number): string {
  if (ageMinutes < 60) return `${ageMinutes}m`;
  const hours = Math.floor(ageMinutes / 60);
  const mins = ageMinutes % 60;
  if (hours < 24) return mins === 0 ? `${hours}h` : `${hours}h ${String(mins).padStart(2, "0")}m`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
}

export function ExceptionList({
  initialItems,
}: {
  initialItems: AdminAttentionItem[];
}) {
  const [items, setItems] = useState<AdminAttentionItem[]>(initialItems);

  const onActionSuccess = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const handleDismissLegacy = useCallback(
    async (itemId: string) => {
      const raId = getRefundAttemptIdFromItemId(itemId);
      if (!raId) return;
      setDismissingId(itemId);
      try {
        const res = await fetch(`/api/admin/refund-attempts/${raId}/dismiss-legacy`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) onActionSuccess(itemId);
      } finally {
        setDismissingId(null);
      }
    },
    [onActionSuccess]
  );

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm font-medium text-stone-700">Nothing needs attention right now</p>
        <p className="mt-1 text-sm text-stone-500">
          All vendor orders are either progressing normally or already resolved.
        </p>
        <Link href="/admin/orders" className="mt-3 inline-block text-sm text-stone-600 hover:underline">
          Inspect orders →
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {items.map((item) => {
        const urgencyLabel = severityToUrgencyLabel(item.severity);
        const ageCompact = formatAgeCompact(item.ageMinutes);
        const isVendorOrder =
          item.scope === "vendor_order" &&
          item.vendorOrderId &&
          item.reason !== "refund_failed";
        const isRefundFailed = item.reason === "refund_failed";

        return (
          <li
            key={item.id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${
              isRefundFailed
                ? "border-l-4 border-l-amber-500 border-stone-200"
                : "border-stone-200"
            }`}
          >
            {/* Header: order (main link), vendor, pod, age — single row for scan */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                href={item.primaryEntityHref}
                className="font-mono text-sm font-semibold text-stone-900 hover:underline"
              >
                #{item.orderId.slice(-8).toUpperCase()}
              </Link>
              {item.vendor?.name && (
                <span className="text-sm text-stone-700">{item.vendor.name}</span>
              )}
              {item.order?.pod?.name && (
                <span className="text-xs text-stone-500">{item.order.pod.name}</span>
              )}
              <span className="ml-auto text-xs text-stone-500" title={`${item.ageMinutes} min`}>
                {ageCompact}
              </span>
            </div>

            {/* Reason + status + urgency */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  isRefundFailed
                    ? "bg-amber-200 text-amber-900"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {item.reason.replace(/_/g, " ")}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  item.severity === "critical"
                    ? "bg-red-100 text-red-800"
                    : item.severity === "medium" || item.severity === "high"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-stone-100 text-stone-700"
                }`}
              >
                {urgencyLabel}
              </span>
              <span className="text-xs text-stone-600">{item.currentStatus}</span>
            </div>

            {/* Why + deliverect details only when relevant */}
            <p className="mt-2 text-sm text-stone-700">{item.reasonLabel}</p>
            {(item.deliverectAttempts != null && item.deliverectAttempts > 0) ||
            item.deliverectSubmittedAt ||
            item.deliverectLastError ? (
              <p className="mt-0.5 text-xs text-stone-500">
                {item.deliverectAttempts != null && item.deliverectAttempts > 0 && (
                  <>Attempts: {item.deliverectAttempts}</>
                )}
                {item.deliverectSubmittedAt && (
                  <> · Last: {formatDate(item.deliverectSubmittedAt)}</>
                )}
                {item.deliverectLastError && (
                  <span className="block truncate text-amber-800" title={item.deliverectLastError}>
                    {item.deliverectLastError.length > 60
                      ? item.deliverectLastError.slice(0, 60) + "…"
                      : item.deliverectLastError}
                  </span>
                )}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
              {isVendorOrder ? (
                <Link
                  href={`/admin/orders/${item.orderId}`}
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-900"
                >
                  Open order
                </Link>
              ) : item.reason === "refund_failed" && getRefundAttemptIdFromItemId(item.id) ? (
                <>
                  <button
                    type="button"
                    title="Remove from queue as legacy/test (e.g. payment_not_captured). Audit trail preserved."
                    onClick={() => handleDismissLegacy(item.id)}
                    disabled={dismissingId === item.id}
                    className="rounded border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {dismissingId === item.id ? "…" : "Dismiss as legacy/test"}
                  </button>
                </>
              ) : (
                <span className="text-xs text-stone-500">
                  Resolve open issue on order (use link above)
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
