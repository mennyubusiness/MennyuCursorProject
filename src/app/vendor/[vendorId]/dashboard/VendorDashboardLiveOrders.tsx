"use client";

import { useState, useEffect, useRef } from "react";
import {
  getVendorOrderBoardGroupKey,
  groupVendorOrdersForBoard,
  type VendorOrdersBoardGroup,
} from "@/lib/vendor-orders-board";
import { useVendorOrdersPoll } from "@/hooks/useVendorOrdersPoll";
import {
  getVendorOrderOperatingMode,
  type VendorOrderOperatingMode,
} from "@/lib/vendor-order-operating-mode";
import {
  getVendorOrderUrgency,
  getReadyWaitMinutes,
  getReadyWaitEscalation,
  getBehindSiblingEscalation,
} from "@/lib/vendor-urgency";
import { getPickupCode } from "@/lib/pickup-code";
import { VendorOrderCard } from "./VendorOrderCard";
import { NewOrderSoundAlert } from "./NewOrderSoundAlert";
import { VendorOrdersSummaryStrip } from "./VendorOrdersSummaryStrip";

type GroupKey = VendorOrdersBoardGroup;

const GROUP_LABELS: Record<GroupKey, string> = {
  new: "Needs action",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled_failed: "Cancelled / failed",
};

type VendorOrderFromApi = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusAuthority?: string | null;
  lastExternalStatus?: string | null;
  lastExternalStatusAt?: string | null;
  deliverectChannelLinkId?: string | null;
  totalCents: number;
  tipCents: number;
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
    priceCents: number;
    specialInstructions: string | null;
    selections: Array<{
      nameSnapshot: string;
      quantity: number;
      modifierOption: { name: string };
    }>;
  }>;
  statusHistory: Array<{ source?: string | null; fulfillmentStatus?: string | null; createdAt: string }>;
  /** Minutes since first sibling vendor in same order became ready; null if N/A. From API. */
  siblingFirstReadyMinutesAgo?: number | null;
  /** True when Deliverect routing missed the healthy window; show manual confirm. */
  deliverectRoutingDegraded?: boolean;
};

function completedTransitionTimeMs(vo: VendorOrderFromApi): number | null {
  const hist = [...(vo.statusHistory ?? [])].reverse();
  for (const h of hist) {
    if (h.fulfillmentStatus === "completed" && h.createdAt) {
      return new Date(h.createdAt).getTime();
    }
  }
  if (vo.fulfillmentStatus === "completed") {
    return new Date(vo.order.createdAt).getTime();
  }
  return null;
}

export function VendorDashboardLiveOrders({
  vendorId,
  vendorDeliverectChannelLinkId = null,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive = false,
}: {
  vendorId: string;
  vendorDeliverectChannelLinkId?: string | null;
  initialVendorOrders: VendorOrderFromApi[];
  /** Stable "now" from server for initial render so SSR and hydration match. */
  initialNowMs: number;
  /** Pass from server (e.g. isRoutingRetryAvailable()) so POS vs Open Order mode is correct. */
  isDeliverectLive?: boolean;
}) {
  const { vendorOrders, nowMs, onStatusSuccess } = useVendorOrdersPoll({
    vendorId,
    initialOrders: initialVendorOrders,
    initialNowMs,
  });
  const seenOrderIdsRef = useRef<Set<string>>(new Set(initialVendorOrders.map((vo) => vo.id)));
  /** Vendor order id → highlight ring expires at this timestamp (ms). ~60s from first seen via poll. */
  const [highlightExpireAtById, setHighlightExpireAtById] = useState<Record<string, number>>({});
  /** Periodic tick so highlight rings clear without full page refresh. */
  const [, setHighlightTick] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelledFailed, setShowCancelledFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setHighlightTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const seen = seenOrderIdsRef.current;
    const newIds = vendorOrders.filter((vo) => !seen.has(vo.id)).map((vo) => vo.id);
    newIds.forEach((id) => seen.add(id));
    if (newIds.length > 0) {
      const exp = Date.now() + 60_000;
      setHighlightExpireAtById((prev) => {
        const next = { ...prev };
        for (const id of newIds) next[id] = exp;
        return next;
      });
    }
  }, [vendorOrders]);

  const grouped = groupVendorOrdersForBoard(vendorOrders);

  const order: GroupKey[] = ["new", "preparing", "ready", "completed", "cancelled_failed"];

  const highlightNow = Date.now();
  const newOrderIdsForSound = grouped.new?.map((vo) => vo.id) ?? [];
  const needsActionCount = grouped.new?.length ?? 0;
  const preparingOnlyCount = grouped.preparing?.length ?? 0;
  const readyCount = grouped.ready?.length ?? 0;
  const startOfTodayMs = (() => {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const completedTodayCount = vendorOrders.filter((vo) => {
    if (getVendorOrderBoardGroupKey(vo) !== "completed") return false;
    const t = completedTransitionTimeMs(vo);
    return t != null && t >= startOfTodayMs;
  }).length;

  return (
    <>
      <NewOrderSoundAlert newOrderIds={newOrderIdsForSound} />
      <div className="mb-10">
        <VendorOrdersSummaryStrip
          needsAttention={needsActionCount}
          preparing={preparingOnlyCount}
          ready={readyCount}
          completedToday={completedTodayCount}
        />
      </div>
      {vendorOrders.length === 0 ? (
        <p className="text-sm text-oo-stone-gray">No orders yet.</p>
      ) : (
        <div className="space-y-12">
          {order.map((key) => {
          const list = grouped[key];
          if (!list || list.length === 0) return null;
          const isTerminalSection = key === "cancelled_failed";
          const collapsible = key === "completed" || key === "cancelled_failed";
          const expanded = collapsible
            ? key === "completed"
              ? showCompleted
              : showCancelledFailed
            : true;

          const sectionBody = (
            <div className="space-y-5">
              {list.map((vo) => {
                const operatingMode = getVendorOrderOperatingMode(
                  {
                    routingStatus: vo.routingStatus,
                    fulfillmentStatus: vo.fulfillmentStatus,
                    manuallyRecoveredAt: vo.manuallyRecoveredAt,
                    statusAuthority: vo.statusAuthority as
                      | import("@/domain/status-authority").VendorOrderStatusAuthority
                      | null
                      | undefined,
                    deliverectChannelLinkId: vo.deliverectChannelLinkId,
                    vendor: { deliverectChannelLinkId: vendorDeliverectChannelLinkId },
                  },
                  vo.statusHistory,
                  isDeliverectLive
                ) as VendorOrderOperatingMode;
                const urgency = getVendorOrderUrgency(new Date(vo.order.createdAt), nowMs);
                const readyWaitMinutes = getReadyWaitMinutes(
                  vo.statusHistory?.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })),
                  nowMs
                );
                const readyWaitEscalation =
                  readyWaitMinutes != null ? getReadyWaitEscalation(readyWaitMinutes) : "neutral";
                const vendorOrderCount = vo.order._count?.vendorOrders ?? 1;
                const pickupCode = getPickupCode(vo.order.id);
                const siblingFirstReadyMinutesAgo = vo.siblingFirstReadyMinutesAgo ?? null;
                const siblingBehindEscalation =
                  siblingFirstReadyMinutesAgo != null && siblingFirstReadyMinutesAgo >= 0
                    ? getBehindSiblingEscalation(siblingFirstReadyMinutesAgo)
                    : "yellow";

                return (
                  <VendorOrderCard
                    key={vo.id}
                    vendorId={vendorId}
                    vendorDeliverectChannelLinkId={vendorDeliverectChannelLinkId}
                    isDeliverectLive={isDeliverectLive}
                    deliverectRoutingDegraded={vo.deliverectRoutingDegraded === true}
                    onStatusSuccess={onStatusSuccess}
                    pickupCode={pickupCode}
                    vendorOrder={{
                      id: vo.id,
                      orderId: vo.orderId,
                      routingStatus: vo.routingStatus,
                      fulfillmentStatus: vo.fulfillmentStatus,
                      manuallyRecoveredAt: vo.manuallyRecoveredAt ?? undefined,
                      statusAuthority: vo.statusAuthority ?? undefined,
                      lastExternalStatus: vo.lastExternalStatus ?? undefined,
                      lastExternalStatusAt: vo.lastExternalStatusAt ?? undefined,
                      deliverectChannelLinkId: vo.deliverectChannelLinkId ?? undefined,
                      statusHistory: vo.statusHistory?.map((h) => ({ source: h.source })) ?? undefined,
                      totalCents: vo.totalCents,
                      tipCents: vo.tipCents ?? 0,
                      order: {
                        id: vo.order.id,
                        orderNotes: vo.order.orderNotes,
                        customerPhone: vo.order.customerPhone,
                        createdAt: vo.order.createdAt,
                      },
                      lineItems: vo.lineItems.map((line) => ({
                        id: line.id,
                        name: line.name,
                        quantity: line.quantity,
                        priceCents: line.priceCents,
                        specialInstructions: line.specialInstructions,
                        selections: line.selections.map((s) => ({
                          nameSnapshot: s.nameSnapshot,
                          quantity: s.quantity,
                          modifierOption: s.modifierOption,
                        })),
                      })),
                    }}
                    operatingMode={operatingMode}
                    urgencyLabel={urgency.label}
                    urgencyLevel={urgency.level}
                    ageText={urgency.ageText}
                    readyWaitMinutes={readyWaitMinutes}
                    readyWaitEscalation={readyWaitEscalation}
                    vendorOrderCount={vendorOrderCount}
                    isNew={(highlightExpireAtById[vo.id] ?? 0) > highlightNow}
                    siblingFirstReadyMinutesAgo={siblingFirstReadyMinutesAgo}
                    siblingBehindEscalation={siblingBehindEscalation}
                  />
                );
              })}
            </div>
          );

          if (collapsible) {
            const open = expanded;
            const setOpen = key === "completed" ? setShowCompleted : setShowCancelledFailed;
            return (
              <section key={key} className="border-t border-oo-light-stone/60 pt-8">
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition hover:bg-oo-cream/80"
                >
                  <h2
                    className={`text-sm font-semibold tracking-tight ${
                      isTerminalSection ? "text-oo-stone-gray" : "text-oo-charcoal"
                    }`}
                  >
                    {GROUP_LABELS[key]}
                    <span className="ml-2 font-normal text-oo-stone-gray">({list.length})</span>
                  </h2>
                  <span className="shrink-0 text-xs font-medium text-oo-charcoal">
                    {open ? "Hide" : "Show"}
                  </span>
                </button>
                {open ? <div className="mt-4">{sectionBody}</div> : null}
              </section>
            );
          }

          return (
            <section key={key}>
              <h2
                className={`mb-4 text-sm font-semibold tracking-tight ${
                  isTerminalSection ? "text-oo-stone-gray" : "text-oo-charcoal"
                }`}
              >
                {GROUP_LABELS[key]}
              </h2>
              {sectionBody}
            </section>
          );
        })}
        </div>
      )}
    </>
  );
}
