"use client";

import Link from "next/link";
import { useState } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import type { VendorOrderStatusAuthority } from "@/domain/status-authority";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";
import {
  isDeliverectAuthoritativeVendorOrder,
  VENDOR_DELIVERECT_CONTROLLED_NOTICE,
} from "@/lib/deliverect-vendor-order-authority";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";
import { getVendorKitchenSkipAheadActions } from "@/lib/vendor-manual-fulfillment";
import {
  formatVendorCustomerPhone,
  getVendorOrderKitchenActionLabel,
} from "@/lib/vendor-order-next-action";
import {
  getOperatingModeActionHint,
  getVendorOrderOperatingMode,
  isMennyuControlsPrimary,
  type VendorOrderOperatingMode,
} from "@/lib/vendor-order-operating-mode";
import { getVendorOrderUrgency } from "@/lib/vendor-urgency";

export type VendorKitchenOrderCardOrder = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusAuthority?: string | null;
  lastExternalStatus?: string | null;
  lastExternalStatusAt?: string | null;
  deliverectChannelLinkId?: string | null;
  statusHistory?: Array<{ source?: string | null; createdAt?: string }>;
  order: {
    id: string;
    orderNotes: string | null;
    customerPhone: string | null;
    createdAt: string;
    _count?: { vendorOrders: number };
  };
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    specialInstructions: string | null;
    selections: Array<{ nameSnapshot: string; quantity: number }>;
  }>;
  deliverectRoutingDegraded?: boolean;
};

function statusBadgeLabel(fulfillmentStatus: string): string {
  if (fulfillmentStatus === "ready") return "Ready";
  if (fulfillmentStatus === "preparing") return "Preparing";
  if (fulfillmentStatus === "accepted") return "Accepted";
  if (fulfillmentStatus === "pending") return "New";
  return fulfillmentStatus;
}

export function VendorKitchenOrderCard({
  vendorId,
  vendorOrder,
  pickupCode,
  operatingMode,
  nowMs,
  isDeliverectLive,
  orderRoutingMode,
  deliverectRoutingDegraded = false,
  vendorDeliverectChannelLinkId = null,
  needsAttention = false,
  onStatusSuccess,
}: {
  vendorId: string;
  vendorOrder: VendorKitchenOrderCardOrder;
  pickupCode: string;
  operatingMode: VendorOrderOperatingMode;
  nowMs: number;
  isDeliverectLive: boolean;
  orderRoutingMode: VendorOrderRoutingMode;
  deliverectRoutingDegraded?: boolean;
  vendorDeliverectChannelLinkId?: string | null;
  needsAttention?: boolean;
  onStatusSuccess?: (
    vendorOrderId: string,
    update: { routingStatus: string; fulfillmentStatus: string }
  ) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const manualDashboard = isManualDashboardRoutingMode(orderRoutingMode);

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

  const deliverectAuthoritative = isDeliverectAuthoritativeVendorOrder(
    authorityVo,
    orderRoutingMode
  );
  const nextAction = deliverectAuthoritative
    ? null
    : getVendorOrderKitchenActionLabel(
        vendorOrder.routingStatus,
        vendorOrder.fulfillmentStatus,
        isDeliverectLive,
        { isManualDashboard: manualDashboard }
      );
  const skipAheadActions = manualDashboard
    ? getVendorKitchenSkipAheadActions(
        vendorOrder.routingStatus,
        vendorOrder.fulfillmentStatus,
        nextAction?.targetState
      )
    : [];
  const showManualConfirmFallback =
    deliverectRoutingDegraded === true &&
    vendorOrder.routingStatus === "pending" &&
    vendorOrder.fulfillmentStatus === "pending";
  const actionHint = deliverectAuthoritative
    ? null
    : getOperatingModeActionHint(operatingMode, authorityVo, isDeliverectLive, deliverectRoutingDegraded);
  const recovered = isVendorOrderManuallyRecovered(vendorOrder, vendorOrder.statusHistory);
  const canDeny = canVendorRejectVendorOrder(
    {
      ...authorityVo,
      fulfillmentStatus: vendorOrder.fulfillmentStatus,
      statusHistory: vendorOrder.statusHistory,
    },
    orderRoutingMode
  );
  const urgency = getVendorOrderUrgency(new Date(vendorOrder.order.createdAt), nowMs);
  const totalItems = vendorOrder.lineItems.reduce((sum, l) => sum + l.quantity, 0);
  const customerPhone = formatVendorCustomerPhone(vendorOrder.order.customerPhone);

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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-oo-warm-white p-5 shadow-sm ${
        needsAttention ? "border-amber-400 ring-2 ring-amber-200/80" : "border-oo-light-stone"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-oo-stone-gray">
            Pickup code
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-tight text-oo-charcoal sm:text-5xl">
            {pickupCode}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-lg bg-brand/15 px-3 py-1 text-sm font-bold uppercase tracking-wide text-brand">
            {statusBadgeLabel(vendorOrder.fulfillmentStatus)}
          </span>
          <p className="mt-2 text-lg font-semibold tabular-nums text-oo-charcoal">{urgency.ageText}</p>
          <p className="text-sm text-oo-stone-gray">{urgency.label}</p>
        </div>
      </div>

      {needsAttention && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Needs attention — check routing or confirm manually below.
        </p>
      )}

      {recovered && (
        <p className="mt-2 text-sm text-amber-900">Manually confirmed — continue in kitchen flow.</p>
      )}

      {customerPhone && (
        <p className="mt-3 text-base text-oo-charcoal">
          <span className="font-semibold">Customer:</span> {customerPhone}
        </p>
      )}

      {(vendorOrder.order._count?.vendorOrders ?? 1) > 1 && (
        <p className="mt-1 text-sm text-oo-stone-gray">Part of a combined order</p>
      )}

      <p className="mt-3 text-sm font-medium text-oo-stone-gray">
        {totalItems} item{totalItems === 1 ? "" : "s"}
      </p>

      <ul className="mt-4 space-y-3 border-t border-oo-light-stone pt-4">
        {vendorOrder.lineItems.map((line) => (
          <li key={line.id}>
            <p className="text-lg font-semibold text-oo-charcoal">
              {line.name} <span className="text-brand">× {line.quantity}</span>
            </p>
            {line.selections.length > 0 && (
              <ul className="mt-1 space-y-0.5 pl-1 text-base text-oo-stone-gray">
                {line.selections.map((s, i) => (
                  <li key={`${line.id}-${i}`}>
                    · {s.nameSnapshot}
                    {s.quantity > 1 ? ` ×${s.quantity}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {line.specialInstructions && (
              <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-950">
                Note: {line.specialInstructions}
              </p>
            )}
          </li>
        ))}
      </ul>

      {vendorOrder.order.orderNotes && (
        <p className="mt-3 rounded-lg border border-oo-light-stone bg-oo-cream/80 px-3 py-2 text-sm text-oo-charcoal">
          <span className="font-semibold">Order note:</span> {vendorOrder.order.orderNotes}
        </p>
      )}

      {deliverectAuthoritative && !showManualConfirmFallback && (
        <div className="mt-4 rounded-xl border border-oo-light-stone bg-oo-cream/60 px-4 py-3">
          <p className="text-sm font-medium text-oo-charcoal">Status controlled by POS</p>
          <p className="mt-1 text-sm text-oo-stone-gray">{VENDOR_DELIVERECT_CONTROLLED_NOTICE}</p>
          {vendorOrder.lastExternalStatus && (
            <p className="mt-2 text-sm text-oo-charcoal">
              POS: <span className="font-semibold">{vendorOrder.lastExternalStatus}</span>
            </p>
          )}
        </div>
      )}

      {(nextAction || canDeny || showManualConfirmFallback || skipAheadActions.length > 0) && (
        <div className="mt-4 space-y-2 border-t border-oo-light-stone pt-4">
          {actionHint && <p className="text-sm text-oo-stone-gray">{actionHint}</p>}
          <div className="flex flex-wrap gap-2">
            {nextAction && (
              <button
                type="button"
                onClick={() => void handleStatusChange(nextAction.targetState)}
                disabled={loading}
                className={
                  isMennyuControlsPrimary(operatingMode, authorityVo) || manualDashboard
                    ? "min-h-[48px] flex-1 rounded-xl bg-brand px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-50"
                    : "min-h-[48px] flex-1 rounded-xl border border-oo-light-stone bg-oo-warm-white px-5 py-3 text-base font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                }
              >
                {loading ? "…" : nextAction.label}
              </button>
            )}
            {canDeny && (
              <button
                type="button"
                onClick={() => void handleStatusChange("cancelled")}
                disabled={loading}
                className="min-h-[48px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Deny
              </button>
            )}
            {showManualConfirmFallback && (
              <button
                type="button"
                onClick={() => void handleStatusChange("confirmed")}
                disabled={loading}
                className="min-h-[48px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                Confirm manually
              </button>
            )}
          </div>
          {skipAheadActions.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMoreActionsOpen((open) => !open)}
                disabled={loading}
                className="min-h-[40px] rounded-lg px-2 text-sm font-semibold text-oo-stone-gray underline-offset-2 hover:text-oo-charcoal hover:underline disabled:opacity-50"
              >
                {moreActionsOpen ? "Hide more actions" : "More actions"}
              </button>
              {moreActionsOpen && (
                <div className="flex flex-wrap gap-2">
                  {skipAheadActions.map((action) => (
                    <button
                      key={action.targetState}
                      type="button"
                      onClick={() => void handleStatusChange(action.targetState)}
                      disabled={loading}
                      className="min-h-[44px] rounded-xl border border-oo-light-stone bg-oo-cream/80 px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-oo-light-stone/80 pt-3">
        <Link
          href={`/vendor/${vendorId}/issues`}
          className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          Need help
        </Link>
        <button
          type="button"
          disabled
          title="Item unavailable reporting is not available yet"
          className="cursor-not-allowed rounded-lg border border-dashed border-oo-light-stone px-3 py-2 text-sm text-oo-stone-gray opacity-60"
        >
          Item unavailable
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </article>
  );
}

export function buildKitchenOperatingMode(
  vo: VendorKitchenOrderCardOrder,
  vendorDeliverectChannelLinkId: string | null,
  isDeliverectLive: boolean
): VendorOrderOperatingMode {
  return getVendorOrderOperatingMode(
    {
      routingStatus: vo.routingStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      manuallyRecoveredAt: vo.manuallyRecoveredAt,
      statusAuthority: vo.statusAuthority as VendorOrderStatusAuthority | null | undefined,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendor: { deliverectChannelLinkId: vendorDeliverectChannelLinkId },
    },
    vo.statusHistory,
    isDeliverectLive
  ) as VendorOrderOperatingMode;
}
