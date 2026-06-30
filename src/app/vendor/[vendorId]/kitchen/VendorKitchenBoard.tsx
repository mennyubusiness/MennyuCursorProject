"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { VendorOrderForBoardClient } from "@/lib/vendor-orders-board-data";
import {
  countActiveBoardGroups,
  groupVendorOrdersForBoard,
  KITCHEN_COLUMN_EMPTY,
  KITCHEN_COLUMN_LABELS,
  VENDOR_ORDERS_ACTIVE_BOARD_GROUPS,
} from "@/lib/vendor-orders-board";
import { getVendorOrderEffectiveDisplayState } from "@/lib/vendor-order-effective-state";
import { getPickupCode } from "@/lib/pickup-code";
import { useVendorOrdersPoll } from "@/hooks/useVendorOrdersPoll";
import { VendorKitchenExitLink } from "../VendorLayoutChrome";
import { VendorKitchenPauseToggle } from "./VendorKitchenPauseToggle";
import {
  VendorKitchenOrderCard,
  buildKitchenOperatingMode,
} from "./VendorKitchenOrderCard";
import { VendorKitchenTestSoundButton } from "./VendorKitchenTestSoundButton";

const NewOrderSoundAlert = dynamic(
  () => import("../dashboard/NewOrderSoundAlert").then((m) => m.NewOrderSoundAlert),
  { ssr: false }
);

export function VendorKitchenBoard({
  vendorId,
  vendorName,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive,
  orderRoutingMode,
  vendorDeliverectChannelLinkId,
  ordersPaused,
  posStatusLine,
  posWarning,
}: {
  vendorId: string;
  vendorName: string;
  initialVendorOrders: VendorOrderForBoardClient[];
  initialNowMs: number;
  isDeliverectLive: boolean;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  vendorDeliverectChannelLinkId: string | null;
  ordersPaused: boolean;
  posStatusLine: string;
  posWarning: string | null;
}) {
  const { vendorOrders, nowMs, onStatusSuccess, fetchError, refresh, isPolling } =
    useVendorOrdersPoll({
      vendorId,
      initialOrders: initialVendorOrders,
      initialNowMs,
    });

  const grouped = useMemo(() => groupVendorOrdersForBoard(vendorOrders), [vendorOrders]);
  const counts = useMemo(() => countActiveBoardGroups(grouped), [grouped]);
  const newOrderIdsForSound = grouped.new.map((vo) => vo.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <NewOrderSoundAlert newOrderIds={newOrderIdsForSound} />

      <header className="sticky top-0 z-20 border-b border-oo-light-stone bg-oo-warm-white/95 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-oo-stone-gray">{vendorName}</p>
            <h1 className="text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl">
              Kitchen Mode
            </h1>
            <p className="mt-1 text-sm text-oo-stone-gray">{posStatusLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {VENDOR_ORDERS_ACTIVE_BOARD_GROUPS.map((key) => (
              <div
                key={key}
                className="rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-oo-stone-gray">
                  {KITCHEN_COLUMN_LABELS[key]}
                </p>
                <p className="text-2xl font-bold tabular-nums text-oo-charcoal">{counts[key]}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <VendorKitchenTestSoundButton />
            <VendorKitchenPauseToggle vendorId={vendorId} initialPaused={ordersPaused} />
            <VendorKitchenExitLink vendorId={vendorId} />
          </div>
        </div>
      </header>

      {ordersPaused && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-950 sm:px-6">
          Open Order intake is paused — new customer orders are blocked. In-progress orders still
          show below.
        </div>
      )}

      {posWarning && (
        <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-2.5 text-center text-sm text-amber-950 sm:px-6">
          {posWarning}
        </div>
      )}

      {fetchError && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg bg-red-800 px-3 py-1.5 font-semibold text-white hover:bg-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {isPolling && vendorOrders.length === 0 && !fetchError && (
        <p className="px-4 py-8 text-center text-oo-stone-gray sm:px-6">Loading orders…</p>
      )}

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-3">
          {VENDOR_ORDERS_ACTIVE_BOARD_GROUPS.map((columnKey) => {
            const list = grouped[columnKey];
            return (
              <section
                key={columnKey}
                className="flex min-h-[280px] flex-col rounded-2xl border border-oo-light-stone/80 bg-oo-warm-white/50 p-4"
              >
                <h2 className="mb-4 text-lg font-bold text-oo-charcoal">
                  {KITCHEN_COLUMN_LABELS[columnKey]}
                  <span className="ml-2 text-base font-normal text-oo-stone-gray">
                    ({list.length})
                  </span>
                </h2>
                {list.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/40 px-4 py-12 text-center text-base text-oo-stone-gray">
                    {KITCHEN_COLUMN_EMPTY[columnKey]}
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {list.map((vo) => {
                      const effective = getVendorOrderEffectiveDisplayState(vo, vo.statusHistory);
                      const needsAttention = effective === "needs_attention";
                      return (
                        <li key={vo.id}>
                          <VendorKitchenOrderCard
                            vendorId={vendorId}
                            vendorOrder={vo}
                            pickupCode={getPickupCode(vo.order.id)}
                            orderRoutingMode={orderRoutingMode}
                            operatingMode={buildKitchenOperatingMode(
                              vo,
                              vendorDeliverectChannelLinkId,
                              isDeliverectLive
                            )}
                            nowMs={nowMs}
                            isDeliverectLive={isDeliverectLive}
                            deliverectRoutingDegraded={vo.deliverectRoutingDegraded === true}
                            vendorDeliverectChannelLinkId={vendorDeliverectChannelLinkId}
                            needsAttention={needsAttention}
                            onStatusSuccess={onStatusSuccess}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-[1600px] text-center text-sm text-oo-stone-gray">
          Completed and cancelled orders are on the{" "}
          <Link href={`/vendor/${vendorId}/orders`} className="font-semibold text-brand hover:underline">
            Orders page
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
