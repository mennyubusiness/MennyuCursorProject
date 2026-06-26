"use client";

import { useMemo, useState } from "react";

import { DashboardEmptyState } from "@/components/dashboard";
import { getPickupCode } from "@/lib/pickup-code";
import { vendorOrderHeadlineStatus } from "@/lib/vendor-order-vendor-display";
import {
  filterVendorOrdersForHistory,
  VENDOR_ORDER_HISTORY_FILTERS,
  type VendorOrderHistoryFilter,
} from "@/lib/vendor-orders-history-filters";
import { getVendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";
import { VendorOrderDetailPanel, type VendorOrderDetailData } from "./VendorOrderDetailPanel";

type HistoryOrder = VendorOrderDetailData & {
  totalRefundedCents?: number;
};

export function VendorOrdersHistorySection({
  orders,
  initialNowMs,
  isDeliverectLive,
  posManaged,
}: {
  orders: HistoryOrder[];
  initialNowMs: number;
  isDeliverectLive: boolean;
  posManaged: boolean;
}) {
  const [filter, setFilter] = useState<VendorOrderHistoryFilter>("today");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterVendorOrdersForHistory(orders, filter, initialNowMs, isDeliverectLive),
    [orders, filter, initialNowMs, isDeliverectLive]
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Order history</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Review past orders and check routing issues.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {VENDOR_ORDER_HISTORY_FILTERS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === chip.id
                ? "bg-oo-charcoal text-white"
                : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <DashboardEmptyState
          title="No orders found for this filter."
          description="Try another date range or check active orders above."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((vo) => {
            const pickupCode = getPickupCode(vo.order.id);
            const needsAttention =
              getVendorOrderOperatingMode(vo, vo.statusHistory, isDeliverectLive) === "needs_attention";
            const headline = vendorOrderHeadlineStatus({
              routingStatus: vo.routingStatus,
              fulfillmentStatus: vo.fulfillmentStatus,
              needsAttention,
            });
            const expanded = expandedId === vo.id;

            return (
              <li key={vo.id} className="rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : vo.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-oo-charcoal">{pickupCode}</p>
                    <p className="mt-1 text-sm text-oo-charcoal">{headline}</p>
                    <p className="mt-0.5 text-xs text-oo-stone-gray">
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(vo.order.createdAt))}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-oo-stone-gray">
                    {expanded ? "Hide" : "Details"}
                  </span>
                </button>
                {expanded ? (
                  <div className="border-t border-oo-light-stone px-2 pb-2">
                    <VendorOrderDetailPanel
                      vendorOrder={vo}
                      posManaged={posManaged}
                      isDeliverectLive={isDeliverectLive}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
