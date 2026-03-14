"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  VendorUrgencyLevel,
  ReadyWaitEscalation,
  BehindSiblingEscalation,
} from "@/lib/vendor-urgency";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";

type VendorOrderForCard = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusHistory?: Array<{ source?: string | null }>;
  totalCents: number;
  order: {
    id: string;
    orderNotes: string | null;
    createdAt: string;
  };
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    specialInstructions: string | null;
    selections: Array<{
      nameSnapshot: string;
      quantity: number;
      modifierOption: { name: string };
    }>;
  }>;
};

function getNextAction(
  routingStatus: string,
  fulfillmentStatus: string
): { targetState: string; label: string } | null {
  if (fulfillmentStatus === "pending" && routingStatus === "pending") {
    return { targetState: "confirmed", label: "Confirm order" };
  }
  if (fulfillmentStatus === "pending" && routingStatus === "confirmed") {
    return { targetState: "accepted", label: "Accept order" };
  }
  if (fulfillmentStatus === "accepted") {
    return { targetState: "preparing", label: "Start preparing" };
  }
  if (fulfillmentStatus === "preparing") {
    return { targetState: "ready", label: "Mark ready" };
  }
  if (fulfillmentStatus === "ready") {
    return { targetState: "completed", label: "Mark completed" };
  }
  return null;
}

const URGENCY_CLASS: Record<VendorUrgencyLevel, string> = {
  new: "bg-emerald-100 text-emerald-800",
  aging: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

const READY_WAIT_CLASS: Record<ReadyWaitEscalation, string> = {
  neutral: "text-stone-600",
  yellow: "text-amber-800 font-medium",
  red: "text-red-700 font-medium",
};

const BEHIND_SIBLING_CLASS: Record<BehindSiblingEscalation, string> = {
  yellow: "text-amber-800 font-medium",
  strong: "text-amber-900 font-semibold",
  red: "text-red-700 font-semibold",
};

export function VendorOrderCard({
  vendorId,
  vendorOrder,
  pickupCode,
  sourceLabel,
  urgencyLabel,
  urgencyLevel,
  ageText,
  readyWaitMinutes,
  readyWaitEscalation = "neutral",
  vendorOrderCount,
  isPosManaged,
  isNew = false,
  siblingFirstReadyMinutesAgo = null,
  siblingBehindEscalation = "yellow",
}: {
  vendorId: string;
  vendorOrder: VendorOrderForCard;
  pickupCode: string;
  sourceLabel: string;
  urgencyLabel: string;
  urgencyLevel: VendorUrgencyLevel;
  ageText: string;
  readyWaitMinutes: number | null;
  /** Escalation for ready-wait display: neutral &lt; 5m, yellow 5–10m, red 10+ */
  readyWaitEscalation?: ReadyWaitEscalation;
  vendorOrderCount: number;
  isPosManaged: boolean;
  /** When true, shows a subtle visual highlight for newly arrived orders (live updates). */
  isNew?: boolean;
  /** Minutes since first sibling (other vendor) in same order became ready; null if N/A. */
  siblingFirstReadyMinutesAgo?: number | null;
  /** Escalation for behind-other-vendors display. */
  siblingBehindEscalation?: BehindSiblingEscalation;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextAction = getNextAction(vendorOrder.routingStatus, vendorOrder.fulfillmentStatus);
  const isTerminal = ["completed", "cancelled"].includes(vendorOrder.fulfillmentStatus);
  const recovered = isVendorOrderManuallyRecovered(vendorOrder, vendorOrder.statusHistory);
  const canDeny = canVendorRejectVendorOrder(vendorOrder);
  const isCancelledOrFailed =
    vendorOrder.fulfillmentStatus === "cancelled" ||
    (vendorOrder.routingStatus === "failed" && !recovered);
  const showUrgency = !isTerminal && !isCancelledOrFailed;
  const orderTime = new Date(vendorOrder.order.createdAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const statusBadgeLabel = isCancelledOrFailed
    ? vendorOrder.fulfillmentStatus === "cancelled"
      ? "Cancelled"
      : "Failed"
    : vendorOrder.fulfillmentStatus === "completed"
      ? "Completed"
      : vendorOrder.fulfillmentStatus === "ready"
        ? "Ready"
        : ["accepted", "preparing"].includes(vendorOrder.fulfillmentStatus)
          ? "Preparing"
          : "New";
  const statusBadgeClass = isCancelledOrFailed
    ? "bg-stone-200 text-stone-600"
    : vendorOrder.fulfillmentStatus === "completed"
      ? "bg-stone-100 text-stone-600"
      : "bg-stone-100 text-stone-700";

  async function handleStatusChange(targetState: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/orders/${vendorOrder.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, targetState }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const totalItems = vendorOrder.lineItems.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        isCancelledOrFailed ? "border-stone-200 bg-stone-50" : "border-stone-200 bg-white"
      } ${isNew ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`}
    >
      {/* Header: order id, status, time, age */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-medium text-stone-700">
            Order #{vendorOrder.order.id.slice(-8).toUpperCase()}
          </p>
          <span className="rounded bg-stone-200 px-2 py-0.5 font-mono text-sm font-semibold text-stone-800" title="Pickup code">
            {pickupCode}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
            {statusBadgeLabel}
          </span>
          {showUrgency && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${URGENCY_CLASS[urgencyLevel]}`}>
              {urgencyLabel}
            </span>
          )}
        </div>
        <div className="text-right text-xs text-stone-500">
          <p>{orderTime}</p>
          <p>{ageText}</p>
        </div>
      </div>

      {/* Routing / source */}
      <p className="mt-2 text-xs text-stone-500">{sourceLabel}</p>

      {/* Ready-wait: only when this vendor order is in ready state */}
      {vendorOrder.fulfillmentStatus === "ready" && readyWaitMinutes !== null && (
        <p className={`mt-1 text-xs ${READY_WAIT_CLASS[readyWaitEscalation]}`}>
          Ready for {readyWaitMinutes}m
        </p>
      )}

      {/* Behind other vendors: only when not ready/completed/cancelled and a sibling is already ready */}
      {siblingFirstReadyMinutesAgo != null &&
        siblingFirstReadyMinutesAgo >= 0 &&
        !["ready", "completed", "cancelled"].includes(vendorOrder.fulfillmentStatus) && (
          <p className={`mt-1 text-xs ${BEHIND_SIBLING_CLASS[siblingBehindEscalation]}`}>
            Behind other vendors · First vendor ready {siblingFirstReadyMinutesAgo}m ago
          </p>
        )}

      {/* Multi-vendor context: generic only; do not show other vendor names */}
      {vendorOrderCount > 1 && (
        <p className="mt-1 text-xs text-stone-500">Part of a combined order</p>
      )}

      {/* Line items: name × qty, modifiers, special instructions */}
      <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3 text-sm">
        {vendorOrder.lineItems.map((line) => (
          <li key={line.id} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="font-medium text-stone-800">
                {line.name} × {line.quantity}
              </span>
              {line.selections.length > 0 && (
                <span className="text-stone-600">
                  — {line.selections.map((s) => `${s.nameSnapshot}${s.quantity > 1 ? ` ×${s.quantity}` : ""}`).join(", ")}
                </span>
              )}
            </div>
            {line.specialInstructions && (
              <p className="text-xs text-amber-800">Note: {line.specialInstructions}</p>
            )}
          </li>
        ))}
      </ul>

      {vendorOrder.order.orderNotes && (
        <p className="mt-2 text-xs text-stone-600">
          <span className="font-medium">Order note:</span> {vendorOrder.order.orderNotes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <p className="text-sm font-medium text-stone-700">
          {totalItems} item{totalItems !== 1 ? "s" : ""} · ${(vendorOrder.totalCents / 100).toFixed(2)}
        </p>
      </div>

      {/* Fallback progression: only when not terminal; framed as backup when POS is source */}
      {(nextAction || canDeny) && !isTerminal && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          {isPosManaged && (
            <p className="mb-1.5 text-xs text-stone-500">
              Status is usually updated by your POS. Use below only if needed (fallback).
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {nextAction && (
              <button
                type="button"
                onClick={() => handleStatusChange(nextAction.targetState)}
                disabled={loading}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {loading ? "…" : nextAction.label}
              </button>
            )}
            {canDeny && (
              <button
                type="button"
                onClick={() => handleStatusChange("cancelled")}
                disabled={loading}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Deny order
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
