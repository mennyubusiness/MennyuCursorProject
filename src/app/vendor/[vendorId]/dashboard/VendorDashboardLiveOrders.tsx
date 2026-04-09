"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getVendorOrderEffectiveDisplayState } from "@/lib/vendor-order-effective-state";
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

type GroupKey = "new" | "preparing" | "ready" | "completed" | "cancelled_failed";

/** Group by effective state so recoverable failures stay in "new" and manually recovered in "preparing". */
function groupKey(vo: {
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  statusHistory?: Array<{ source?: string | null }>;
}): GroupKey {
  const effective = getVendorOrderEffectiveDisplayState(vo, vo.statusHistory);
  if (effective === "cancelled" || effective === "terminal_failed") return "cancelled_failed";
  if (effective === "completed") return "completed";
  if (effective === "ready") return "ready";
  if (effective === "recovered" || effective === "active") return "preparing";
  if (effective === "needs_attention") return "new";
  return "new";
}

const GROUP_LABELS: Record<GroupKey, string> = {
  new: "Needs action",
  preparing: "In progress",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled_failed: "Cancelled / Failed",
};

type VendorOrderFromApi = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
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

const POLL_INTERVAL_MS = 5000;

const AGE_UPDATE_INTERVAL_MS = 60_000;

export function VendorDashboardLiveOrders({
  vendorId,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive = false,
}: {
  vendorId: string;
  initialVendorOrders: VendorOrderFromApi[];
  /** Stable "now" from server for initial render so SSR and hydration match. */
  initialNowMs: number;
  /** Pass from server (e.g. isRoutingRetryAvailable()) so POS vs Mennyu mode is correct. */
  isDeliverectLive?: boolean;
}) {
  const [vendorOrders, setVendorOrders] = useState<VendorOrderFromApi[]>(initialVendorOrders);
  const [nowMs, setNowMs] = useState(initialNowMs);
  const seenOrderIdsRef = useRef<Set<string>>(new Set(initialVendorOrders.map((vo) => vo.id)));
  /** Vendor order id → highlight ring expires at this timestamp (ms). ~60s from first seen via poll. */
  const [highlightExpireAtById, setHighlightExpireAtById] = useState<Record<string, number>>({});
  /** Periodic tick so highlight rings clear without full page refresh. */
  const [, setHighlightTick] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setHighlightTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const onStatusSuccess = useCallback(
    (vendorOrderId: string, update: { routingStatus: string; fulfillmentStatus: string }) => {
      setVendorOrders((prev) =>
        prev.map((vo) =>
          vo.id === vendorOrderId
            ? { ...vo, routingStatus: update.routingStatus, fulfillmentStatus: update.fulfillmentStatus }
            : vo
        )
      );
    },
    []
  );

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), AGE_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onVisibility = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const ac = new AbortController();
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/vendor/${vendorId}/orders`, { signal: ac.signal });
        if (!res.ok) return;
        const data = await res.json();
        const list: VendorOrderFromApi[] = data.vendorOrders ?? [];
        setVendorOrders(list);

        const currentIds = new Set(list.map((vo: VendorOrderFromApi) => vo.id));
        const seen = seenOrderIdsRef.current;
        const newIds = list.filter((vo: VendorOrderFromApi) => !seen.has(vo.id)).map((vo: VendorOrderFromApi) => vo.id);
        newIds.forEach((id: string) => seen.add(id));
        if (newIds.length > 0) {
          const exp = Date.now() + 60_000;
          setHighlightExpireAtById((prev) => {
            const next = { ...prev };
            for (const id of newIds) next[id] = exp;
            return next;
          });
        }
      } catch {
        // ignore (e.g. aborted when effect re-runs)
      }
    };

    const id = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, [vendorId, isVisible]);

  const grouped = vendorOrders.reduce<Record<GroupKey, VendorOrderFromApi[]>>(
    (acc, vo) => {
      const key = groupKey(vo);
      if (!acc[key]) acc[key] = [];
      acc[key].push(vo);
      return acc;
    },
    { new: [], preparing: [], ready: [], completed: [], cancelled_failed: [] }
  );

  const order: GroupKey[] = ["new", "preparing", "ready", "completed", "cancelled_failed"];

  const highlightNow = Date.now();
  const newOrderIdsForSound = grouped.new?.map((vo) => vo.id) ?? [];
  const needsActionCount = grouped.new?.length ?? 0;
  const preparingOnlyCount = grouped.preparing?.length ?? 0;
  const inProgressCount = preparingOnlyCount + (grouped.ready?.length ?? 0);
  const readyCount = grouped.ready?.length ?? 0;
  const completedCount = grouped.completed?.length ?? 0;

  const startOfTodayMs = (() => {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const ordersToday = vendorOrders.filter(
    (vo) => new Date(vo.order.createdAt).getTime() >= startOfTodayMs
  ).length;

  return (
    <>
      <NewOrderSoundAlert newOrderIds={newOrderIdsForSound} />
      {vendorOrders.length > 0 && (
        <VendorOrdersSummaryStrip
          ordersToday={ordersToday}
          needsAttention={needsActionCount}
          inProgress={inProgressCount}
          ready={readyCount}
        />
      )}
      {vendorOrders.length > 0 && (
        <p className="mb-4 text-sm text-stone-600">
          <span className="font-medium text-stone-800">{needsActionCount}</span> need action
          <span className="text-stone-400"> · </span>
          <span className="font-medium text-stone-800">{preparingOnlyCount}</span> preparing
          <span className="text-stone-400"> · </span>
          <span className="font-medium text-stone-800">{readyCount}</span> ready
          <span className="text-stone-400"> · </span>
          <span className="text-stone-500">{completedCount} completed (shown)</span>
        </p>
      )}
      {vendorOrders.length === 0 ? (
        <p className="text-sm text-stone-500">No orders yet.</p>
      ) : (
        order.map((key) => {
          const list = grouped[key];
          if (!list || list.length === 0) return null;
          const isTerminalSection = key === "cancelled_failed";
          return (
            <section key={key}>
              <h2
                className={`mb-3 text-xs font-semibold uppercase tracking-[0.14em] ${
                  isTerminalSection ? "text-stone-400" : "text-stone-600"
                }`}
              >
                {GROUP_LABELS[key]}
              </h2>
              <div className="space-y-4">
                {list.map((vo) => {
                  const operatingMode = getVendorOrderOperatingMode(
                    vo,
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
            </section>
          );
        })
      )}
    </>
  );
}
