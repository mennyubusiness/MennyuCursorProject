"use client";

import { useState, useEffect, useRef } from "react";
import { getVendorOrderSourceLabel } from "@/lib/vendor-order-source";
import { getVendorOrderEffectiveDisplayState } from "@/lib/vendor-order-effective-state";
import {
  getVendorOrderUrgency,
  getReadyWaitMinutes,
  getReadyWaitEscalation,
  getBehindSiblingEscalation,
} from "@/lib/vendor-urgency";
import { getPickupCode } from "@/lib/pickup-code";
import { VendorOrderCard } from "./VendorOrderCard";
import { NewOrderSoundAlert } from "./NewOrderSoundAlert";

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
  new: "New orders",
  preparing: "Preparing",
  ready: "Ready for pickup",
  completed: "Recent completed",
  cancelled_failed: "Cancelled / Failed",
};

type VendorOrderFromApi = {
  id: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt?: string | null;
  totalCents: number;
  order: {
    id: string;
    orderNotes: string | null;
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
};

const POLL_INTERVAL_MS = 5000;

export function VendorDashboardLiveOrders({
  vendorId,
  initialVendorOrders,
}: {
  vendorId: string;
  initialVendorOrders: VendorOrderFromApi[];
}) {
  const [vendorOrders, setVendorOrders] = useState<VendorOrderFromApi[]>(initialVendorOrders);
  const seenOrderIdsRef = useRef<Set<string>>(new Set(initialVendorOrders.map((vo) => vo.id)));
  const [newlyArrivedOrderIds, setNewlyArrivedOrderIds] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const onVisibility = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/vendor/${vendorId}/orders`);
        if (!res.ok) return;
        const data = await res.json();
        const list: VendorOrderFromApi[] = data.vendorOrders ?? [];
        setVendorOrders(list);

        const currentIds = new Set(list.map((vo: VendorOrderFromApi) => vo.id));
        const seen = seenOrderIdsRef.current;
        const newIds = list.filter((vo: VendorOrderFromApi) => !seen.has(vo.id)).map((vo: VendorOrderFromApi) => vo.id);
        newIds.forEach((id: string) => seen.add(id));
        if (newIds.length > 0) {
          setNewlyArrivedOrderIds((prev) => new Set([...prev, ...newIds]));
        }
      } catch {
        // ignore
      }
    };

    const id = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(id);
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

  const newOrderIdsForSound = grouped.new?.map((vo) => vo.id) ?? [];

  return (
    <>
      <NewOrderSoundAlert newOrderIds={newOrderIdsForSound} />
      {vendorOrders.length === 0 ? (
        <p className="text-sm text-stone-500">No orders yet.</p>
      ) : (
        order.map((key) => {
          const list = grouped[key];
          if (!list || list.length === 0) return null;
          const isTerminalSection = key === "cancelled_failed";
          return (
            <section key={key}>
              <h2 className={`mb-3 font-medium ${isTerminalSection ? "text-stone-500" : "text-stone-800"}`}>
                {GROUP_LABELS[key]}
              </h2>
              <div className="space-y-4">
                {list.map((vo) => {
                  const sourceLabel = getVendorOrderSourceLabel(vo, vo.statusHistory);
                  const urgency = getVendorOrderUrgency(new Date(vo.order.createdAt));
                  const readyWaitMinutes = getReadyWaitMinutes(
                    vo.statusHistory?.map((h) => ({ ...h, createdAt: new Date(h.createdAt) }))
                  );
                  const readyWaitEscalation =
                    readyWaitMinutes != null ? getReadyWaitEscalation(readyWaitMinutes) : "neutral";
                  const vendorOrderCount = vo.order._count?.vendorOrders ?? 1;
                  const isPosManaged = sourceLabel === "POS / Deliverect synced";
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
                      pickupCode={pickupCode}
                      vendorOrder={{
                        id: vo.id,
                        orderId: vo.orderId,
                        routingStatus: vo.routingStatus,
                        fulfillmentStatus: vo.fulfillmentStatus,
                        manuallyRecoveredAt: vo.manuallyRecoveredAt ?? undefined,
                        statusHistory: vo.statusHistory?.map((h) => ({ source: h.source })) ?? undefined,
                        totalCents: vo.totalCents,
                        order: {
                          id: vo.order.id,
                          orderNotes: vo.order.orderNotes,
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
                      sourceLabel={sourceLabel}
                      urgencyLabel={urgency.label}
                      urgencyLevel={urgency.level}
                      ageText={urgency.ageText}
                      readyWaitMinutes={readyWaitMinutes}
                      readyWaitEscalation={readyWaitEscalation}
                      vendorOrderCount={vendorOrderCount}
                      isPosManaged={isPosManaged}
                      isNew={newlyArrivedOrderIds.has(vo.id)}
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
