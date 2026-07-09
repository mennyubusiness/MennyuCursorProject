"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import type { VendorOrderStatusAuthority } from "@/domain/status-authority";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";
import {
  getKitchenActionPolicy,
  vendorKitchenActionBlockedMessage,
} from "@/lib/order-routing/kitchen-action-policy";
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
  squareOrderId?: string | null;
  deliverectOrderId?: string | null;
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
  isDeliverectLive = null,
  orderRoutingMode,
  deliverectRoutingDegraded = false,
  vendorDeliverectChannelLinkId = null,
  squareStatusSyncConfigured = null,
  needsAttention = false,
  isNewHighlight = false,
  onStatusSuccess,
}: {
  vendorId: string;
  vendorOrder: VendorKitchenOrderCardOrder;
  pickupCode: string;
  operatingMode: VendorOrderOperatingMode;
  nowMs: number;
  /** When true, healthy path expects POS sync first. null = unknown for sync copy. */
  isDeliverectLive?: boolean | null;
  orderRoutingMode: VendorOrderRoutingMode;
  deliverectRoutingDegraded?: boolean;
  vendorDeliverectChannelLinkId?: string | null;
  /** true/false when known from server; null/omitted = unknown (neutral sync copy). */
  squareStatusSyncConfigured?: boolean | null;
  needsAttention?: boolean;
  isNewHighlight?: boolean;
  onStatusSuccess?: (
    vendorOrderId: string,
    update: { routingStatus: string; fulfillmentStatus: string }
  ) => void;
}) {
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const deliverectLive = isDeliverectLive === true;

  const manualDashboard = isManualDashboardRoutingMode(orderRoutingMode);
  const loading = loadingTarget !== null;

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

  const kitchenPolicy = getKitchenActionPolicy(
    {
      orderRoutingMode,
      deliverectChannelLinkId: vendorDeliverectChannelLinkId,
    },
    {
      routingStatus: vendorOrder.routingStatus,
      fulfillmentStatus: vendorOrder.fulfillmentStatus,
      squareOrderId: vendorOrder.squareOrderId,
      deliverectOrderId: vendorOrder.deliverectOrderId,
      manuallyRecoveredAt: vendorOrder.manuallyRecoveredAt,
      statusAuthority: authorityVo.statusAuthority,
      deliverectChannelLinkId: authorityVo.deliverectChannelLinkId,
      vendor: authorityVo.vendor,
    },
    {
      squareStatusSyncConfigured,
      deliverectRoutingLive: isDeliverectLive,
    }
  );
  const actionsLocked = kitchenPolicy.actionsLocked;
  const nextAction = actionsLocked
    ? null
    : getVendorOrderKitchenActionLabel(
        vendorOrder.routingStatus,
        vendorOrder.fulfillmentStatus,
        deliverectLive,
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
  const actionHint = actionsLocked
    ? null
    : getOperatingModeActionHint(operatingMode, authorityVo, deliverectLive, deliverectRoutingDegraded);
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
  const totalItems = vendorOrder.lineItems.reduce((sum, line) => sum + line.quantity, 0);
  const customerPhone = formatVendorCustomerPhone(vendorOrder.order.customerPhone);

  async function handleStatusChange(targetState: string) {
    if (inFlightRef.current || loading) return;
    inFlightRef.current = true;
    setError(null);
    setLoadingTarget(targetState);
    try {
      const res = await fetch(`/api/vendor/orders/${vendorOrder.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, targetState }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update order. Try again.");
        return;
      }
      if (onStatusSuccess && data.routingStatus != null && data.fulfillmentStatus != null) {
        onStatusSuccess(vendorOrder.id, {
          routingStatus: data.routingStatus,
          fulfillmentStatus: data.fulfillmentStatus,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      inFlightRef.current = false;
      setLoadingTarget(null);
    }
  }

  const cardRing =
    isNewHighlight || needsAttention
      ? isNewHighlight
        ? "border-brand ring-2 ring-brand/30"
        : "border-amber-400 ring-2 ring-amber-200/80"
      : "border-oo-light-stone";

  return (
    <article className={`flex flex-col rounded-2xl border bg-oo-warm-white p-4 shadow-sm sm:p-5 ${cardRing}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-oo-stone-gray">
            Pickup code
          </p>
          <p className="mt-0.5 font-mono text-4xl font-bold leading-none tracking-tight text-oo-charcoal sm:text-5xl">
            {pickupCode}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="inline-block rounded-lg bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand sm:text-sm">
            {statusBadgeLabel(vendorOrder.fulfillmentStatus)}
          </span>
          {kitchenPolicy.managedOrderBadge && kitchenPolicy.showProviderManagedState ? (
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-oo-stone-gray">
              {kitchenPolicy.managedOrderBadge}
            </p>
          ) : null}
          <p className="mt-2 text-lg font-bold tabular-nums text-oo-charcoal">{urgency.ageText}</p>
          <p className="text-xs text-oo-stone-gray sm:text-sm">{urgency.label}</p>
        </div>
      </div>

      {/* Compact provider badge only — no sync copy / provider status / timestamps on vendor cards. */}

      {isNewHighlight ? (
        <p className="mt-3 rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">
          New order
        </p>
      ) : null}

      {needsAttention ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Needs attention — confirm manually if routing did not complete.
        </p>
      ) : null}

      {kitchenPolicy.routingFailed && kitchenPolicy.recoveryCopy ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {kitchenPolicy.recoveryCopy}
        </p>
      ) : null}

      {kitchenPolicy.recoveryCopy && recovered ? (
        <p className="mt-2 text-sm text-amber-900">{kitchenPolicy.recoveryCopy}</p>
      ) : null}

      {recovered && !kitchenPolicy.recoveryCopy ? (
        <p className="mt-2 text-sm text-amber-900">Manually confirmed — continue in kitchen flow.</p>
      ) : null}

      {customerPhone ? (
        <p className="mt-3 text-base font-medium text-oo-charcoal">
          Customer <span className="font-normal text-oo-stone-gray">{customerPhone}</span>
        </p>
      ) : null}

      {(vendorOrder.order._count?.vendorOrders ?? 1) > 1 ? (
        <p className="mt-1 text-sm text-oo-stone-gray">Part of a combined order</p>
      ) : null}

      <ul className="mt-4 space-y-3 border-t border-oo-light-stone pt-4">
        {vendorOrder.lineItems.map((line) => (
          <li key={line.id} className="min-w-0">
            <p className="break-words text-base font-semibold text-oo-charcoal sm:text-lg">
              <span className="mr-2 inline-flex min-w-[2rem] items-center justify-center rounded-md bg-brand/15 px-2 py-0.5 text-sm font-bold text-brand">
                {line.quantity}×
              </span>
              {line.name}
            </p>
            {line.selections.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 pl-1 text-sm text-oo-stone-gray sm:text-base">
                {line.selections.map((selection, index) => (
                  <li key={`${line.id}-${index}`} className="break-words">
                    + {selection.nameSnapshot}
                    {selection.quantity > 1 ? ` ×${selection.quantity}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {line.specialInstructions ? (
              <p className="mt-1.5 break-words rounded-lg bg-amber-50 px-2.5 py-2 text-sm font-medium text-amber-950">
                Special: {line.specialInstructions}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {vendorOrder.order.orderNotes ? (
        <p className="mt-3 break-words rounded-lg border border-oo-light-stone bg-oo-cream/80 px-3 py-2 text-sm text-oo-charcoal">
          <span className="font-semibold">Order note:</span> {vendorOrder.order.orderNotes}
        </p>
      ) : null}

      {(nextAction || canDeny || showManualConfirmFallback || skipAheadActions.length > 0) && (
        <div className="mt-4 space-y-3 border-t border-oo-light-stone pt-4">
          {actionHint && !manualDashboard ? (
            <p className="text-sm text-oo-stone-gray">{actionHint}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {nextAction ? (
              <button
                type="button"
                onClick={() => void handleStatusChange(nextAction.targetState)}
                disabled={loading || actionsLocked}
                title={actionsLocked ? vendorKitchenActionBlockedMessage(kitchenPolicy) : undefined}
                className={
                  isMennyuControlsPrimary(operatingMode, authorityVo) || manualDashboard
                    ? "min-h-[56px] w-full rounded-xl bg-brand px-5 py-3.5 text-lg font-bold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-50"
                    : "min-h-[56px] w-full rounded-xl border border-oo-light-stone bg-oo-warm-white px-5 py-3.5 text-lg font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                }
              >
                {loadingTarget === nextAction.targetState ? "Updating…" : nextAction.label}
              </button>
            ) : null}
            {showManualConfirmFallback ? (
              <button
                type="button"
                onClick={() => void handleStatusChange("confirmed")}
                disabled={loading}
                className="min-h-[48px] w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                {loadingTarget === "confirmed" ? "Updating…" : "Confirm manually"}
              </button>
            ) : null}
          </div>
          {skipAheadActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skipAheadActions.map((action) => (
                <button
                  key={action.targetState}
                  type="button"
                  onClick={() => void handleStatusChange(action.targetState)}
                  disabled={loading || actionsLocked}
                  title={actionsLocked ? vendorKitchenActionBlockedMessage(kitchenPolicy) : undefined}
                  className="min-h-[44px] flex-1 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-50 sm:flex-none sm:px-4"
                >
                  {loadingTarget === action.targetState ? "…" : action.label}
                </button>
              ))}
            </div>
          ) : null}
          {canDeny ? (
            <button
              type="button"
              onClick={() => void handleStatusChange("cancelled")}
              disabled={loading}
              className="min-h-[40px] self-start rounded-lg px-2 py-1 text-sm font-medium text-red-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {loadingTarget === "cancelled" ? "Cancelling…" : "Deny order"}
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-3 border-t border-oo-light-stone/60 pt-2">
        <Link
          href={`/vendor/${vendorId}/orders?filter=issues`}
          className="inline-flex min-h-[40px] items-center text-sm font-semibold text-oo-stone-gray hover:text-oo-charcoal"
        >
          View issue in Orders ledger
        </Link>
      </div>
    </article>
  );
}

export function buildKitchenOperatingMode(
  vo: VendorKitchenOrderCardOrder,
  vendorDeliverectChannelLinkId: string | null,
  isDeliverectLive: boolean | null | undefined
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
    isDeliverectLive === true
  ) as VendorOrderOperatingMode;
}
