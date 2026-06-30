"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  VendorUrgencyLevel,
  ReadyWaitEscalation,
  BehindSiblingEscalation,
} from "@/lib/vendor-urgency";
import type { VendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";
import {
  getOperatingModeActionHint,
  isMennyuControlsPrimary,
} from "@/lib/vendor-order-operating-mode";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";
import {
  formatVendorCustomerPhone,
  getVendorOrderNextAction,
} from "@/lib/vendor-order-next-action";
import type { VendorOrderStatusAuthority } from "@/domain/status-authority";
import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  isDeliverectAuthoritativeVendorOrder,
  VENDOR_DELIVERECT_CONTROLLED_NOTICE,
} from "@/lib/deliverect-vendor-order-authority";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";

type VendorOrderForCard = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusAuthority?: string | null;
  lastExternalStatus?: string | null;
  lastExternalStatusAt?: string | null;
  deliverectChannelLinkId?: string | null;
  statusHistory?: Array<{ source?: string | null }>;
  totalCents: number;
  tipCents: number;
  order: {
    id: string;
    orderNotes: string | null;
    customerPhone: string | null;
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

const URGENCY_INLINE_CLASS: Record<VendorUrgencyLevel, string> = {
  new: "text-emerald-800",
  aging: "text-amber-800",
  urgent: "text-red-800",
};

const READY_WAIT_CLASS: Record<ReadyWaitEscalation, string> = {
  neutral: "text-oo-stone-gray",
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
  operatingMode,
  urgencyLabel,
  urgencyLevel,
  ageText,
  readyWaitMinutes,
  readyWaitEscalation = "neutral",
  vendorOrderCount,
  isNew = false,
  siblingFirstReadyMinutesAgo = null,
  siblingBehindEscalation = "yellow",
  onStatusSuccess,
  isDeliverectLive = false,
  deliverectRoutingDegraded = false,
  vendorDeliverectChannelLinkId = null,
  orderRoutingMode = "manual_dashboard",
}: {
  vendorId: string;
  vendorOrder: VendorOrderForCard;
  pickupCode: string;
  operatingMode: VendorOrderOperatingMode;
  urgencyLabel: string;
  urgencyLevel: VendorUrgencyLevel;
  ageText: string;
  readyWaitMinutes: number | null;
  /** Escalation for ready-wait display: neutral &lt; 5m, yellow 5–10m, red 10+ */
  readyWaitEscalation?: ReadyWaitEscalation;
  vendorOrderCount: number;
  /** When true, shows a subtle visual highlight for newly arrived orders (live updates). */
  isNew?: boolean;
  /** Minutes since first sibling (other vendor) in same order became ready; null if N/A. */
  siblingFirstReadyMinutesAgo?: number | null;
  /** Escalation for behind-other-vendors display. */
  siblingBehindEscalation?: BehindSiblingEscalation;
  /** When set, status change success updates this VO in parent state instead of full router.refresh(). */
  onStatusSuccess?: (vendorOrderId: string, update: { routingStatus: string; fulfillmentStatus: string }) => void;
  /** When true, healthy path expects POS sync first — hide primary Confirm until sent/confirmed. */
  isDeliverectLive?: boolean;
  /** Live Deliverect VO stuck in pending/pending past the healthy wait — show manual confirm + degraded copy. */
  deliverectRoutingDegraded?: boolean;
  vendorDeliverectChannelLinkId?: string | null;
  orderRoutingMode?: VendorOrderRoutingMode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorityVo = {
    routingStatus: vendorOrder.routingStatus,
    fulfillmentStatus: vendorOrder.fulfillmentStatus,
    manuallyRecoveredAt: vendorOrder.manuallyRecoveredAt,
    statusAuthority: (vendorOrder.statusAuthority as VendorOrderStatusAuthority | null) ?? null,
    lastStatusSource: null,
    deliverectChannelLinkId:
      vendorOrder.deliverectChannelLinkId ?? vendorDeliverectChannelLinkId,
    vendor: { deliverectChannelLinkId: vendorDeliverectChannelLinkId },
  };
  const manualDashboard = isManualDashboardRoutingMode(orderRoutingMode);
  const deliverectAuthoritative = isDeliverectAuthoritativeVendorOrder(
    authorityVo,
    orderRoutingMode
  );

  const nextAction = deliverectAuthoritative
    ? null
    : getVendorOrderNextAction(
        vendorOrder.routingStatus,
        vendorOrder.fulfillmentStatus,
        isDeliverectLive,
        { isManualDashboard: manualDashboard }
      );
  const showManualConfirmFallback =
    deliverectRoutingDegraded === true &&
    vendorOrder.routingStatus === "pending" &&
    vendorOrder.fulfillmentStatus === "pending";
  const actionHint = deliverectAuthoritative
    ? null
    : getOperatingModeActionHint(
        operatingMode,
        authorityVo,
        isDeliverectLive,
        deliverectRoutingDegraded
      );
  const isTerminal = ["completed", "cancelled"].includes(vendorOrder.fulfillmentStatus);
  const recovered = isVendorOrderManuallyRecovered(vendorOrder, vendorOrder.statusHistory);
  const canDeny = canVendorRejectVendorOrder(
    {
      ...authorityVo,
      fulfillmentStatus: vendorOrder.fulfillmentStatus,
      statusHistory: vendorOrder.statusHistory,
    },
    orderRoutingMode
  );
  const isCancelledOrFailed =
    vendorOrder.fulfillmentStatus === "cancelled" ||
    (vendorOrder.routingStatus === "failed" && !recovered);
  const showUrgency = !isTerminal && !isCancelledOrFailed;
  const statusBadgeLabel = isCancelledOrFailed
    ? vendorOrder.fulfillmentStatus === "cancelled"
      ? "Cancelled"
      : "Failed"
    : vendorOrder.fulfillmentStatus === "completed"
      ? "Completed"
      : vendorOrder.fulfillmentStatus === "ready"
        ? "Ready"
        : vendorOrder.fulfillmentStatus === "preparing"
          ? "Preparing"
          : vendorOrder.fulfillmentStatus === "accepted"
            ? "Confirmed"
            : vendorOrder.fulfillmentStatus === "pending"
              ? "Received"
              : "New";
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
      if (onStatusSuccess && data.routingStatus != null && data.fulfillmentStatus != null) {
        onStatusSuccess(vendorOrder.id, {
          routingStatus: data.routingStatus,
          fulfillmentStatus: data.fulfillmentStatus,
        });
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const totalItems = vendorOrder.lineItems.reduce((sum, l) => sum + l.quantity, 0);

  const cardRingClass = isNew
    ? "ring-2 ring-stone-900/55 ring-offset-2"
    : isCancelledOrFailed
      ? "ring-1 ring-stone-200/80"
      : "ring-1 ring-stone-200/70";

  const statusLineClass =
    urgencyLevel === "urgent"
      ? "text-red-800"
      : urgencyLevel === "aging"
        ? "text-amber-900"
        : "text-oo-charcoal";

  return (
    <div
      className={`rounded-xl p-4 transition-shadow ${
        isCancelledOrFailed ? "bg-oo-cream" : "bg-oo-warm-white"
      } ${cardRingClass}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded bg-brand px-2.5 py-1 font-mono text-sm font-semibold text-white"
              title="Pickup code for the customer"
            >
              {pickupCode}
            </span>
          </div>
          <p className={`mt-2 text-sm font-medium ${statusLineClass}`}>
            {statusBadgeLabel}
            {showUrgency && (
              <>
                <span className="font-normal text-oo-stone-gray"> · </span>
                <span className={URGENCY_INLINE_CLASS[urgencyLevel]}>{urgencyLabel}</span>
              </>
            )}
            <span className="font-normal text-oo-stone-gray"> · {ageText}</span>
          </p>
          {vendorOrder.fulfillmentStatus === "ready" && readyWaitMinutes !== null && (
            <p className={`mt-0.5 text-xs ${READY_WAIT_CLASS[readyWaitEscalation]}`}>
              Waiting for pickup · {readyWaitMinutes}m
            </p>
          )}
          {siblingFirstReadyMinutesAgo != null &&
            siblingFirstReadyMinutesAgo >= 0 &&
            !["ready", "completed", "cancelled"].includes(vendorOrder.fulfillmentStatus) && (
              <p className={`mt-0.5 text-xs ${BEHIND_SIBLING_CLASS[siblingBehindEscalation]}`}>
                Another vendor in this order is already ready ({siblingFirstReadyMinutesAgo}m ago)
              </p>
            )}
        </div>
      </div>

      {formatVendorCustomerPhone(vendorOrder.order.customerPhone) && (
        <p className="mt-1 text-xs text-oo-stone-gray">
          <span className="font-medium text-oo-charcoal">Customer:</span>{" "}
          {formatVendorCustomerPhone(vendorOrder.order.customerPhone)}
        </p>
      )}

      {/* Multi-vendor context: generic only; do not show other vendor names */}
      {vendorOrderCount > 1 && (
        <p className="mt-1 text-xs text-oo-stone-gray">Part of a combined order</p>
      )}

      {/* Line items: name × qty, modifiers, special instructions */}
      <ul className="mt-3 space-y-2 border-t border-oo-light-stone/90 pt-3 text-sm">
        {vendorOrder.lineItems.map((line) => (
          <li key={line.id} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="font-medium text-oo-charcoal">
                {line.name} × {line.quantity}
              </span>
              {line.selections.length > 0 && (
                <span className="text-oo-stone-gray">
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
        <p className="mt-2 text-xs text-oo-stone-gray">
          <span className="font-medium">Order note:</span> {vendorOrder.order.orderNotes}
        </p>
      )}

      <div className="mt-3 space-y-1 border-t border-oo-light-stone/90 pt-3 text-sm">
        <p className="font-medium text-oo-charcoal">
          {totalItems} item{totalItems !== 1 ? "s" : ""} · Items{" "}
          <span className="tabular-nums">${(vendorOrder.totalCents / 100).toFixed(2)}</span>
          {" · Tip "}
          <span
            className={
              vendorOrder.tipCents > 0 ? "tabular-nums text-emerald-800" : "tabular-nums text-oo-stone-gray"
            }
          >
            ${(vendorOrder.tipCents / 100).toFixed(2)}
          </span>
        </p>
      </div>

      {deliverectAuthoritative && !isTerminal && !isCancelledOrFailed && !showManualConfirmFallback && (
        <div className="mt-3 rounded-lg border border-oo-light-stone bg-oo-cream/50 px-3 py-2.5">
          <p className="text-xs text-oo-stone-gray">{VENDOR_DELIVERECT_CONTROLLED_NOTICE}</p>
          {(vendorOrder.lastExternalStatus || vendorOrder.lastExternalStatusAt) && (
            <p className="mt-1.5 text-xs text-oo-charcoal">
              {vendorOrder.lastExternalStatus && (
                <span className="font-medium">POS status: {vendorOrder.lastExternalStatus}</span>
              )}
              {vendorOrder.lastExternalStatusAt && (
                <span className="text-oo-stone-gray">
                  {vendorOrder.lastExternalStatus ? " · " : ""}
                  Updated{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(vendorOrder.lastExternalStatusAt))}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Status actions: Open Order–authoritative orders only */}
      {(nextAction || canDeny || showManualConfirmFallback) && !isTerminal && (
        <div className="mt-3 border-t border-oo-light-stone/90 pt-3">
          {actionHint && (
            <p className="mb-1.5 text-xs text-oo-stone-gray">{actionHint}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {nextAction && (
              <button
                type="button"
                onClick={() => handleStatusChange(nextAction.targetState)}
                disabled={loading}
                className={
                  isMennyuControlsPrimary(operatingMode, authorityVo)
                    ? "rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-50"
                    : "rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-medium text-oo-charcoal shadow-sm hover:bg-oo-cream disabled:opacity-50"
                }
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
            {showManualConfirmFallback && (
              <button
                type="button"
                onClick={() => handleStatusChange("confirmed")}
                disabled={loading}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Confirm manually (POS didn&apos;t sync)
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
