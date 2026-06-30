"use client";



import Link from "next/link";

import dynamic from "next/dynamic";

import { useEffect, useMemo, useRef, useState } from "react";

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

import { VendorKitchenHeader } from "./VendorKitchenHeader";

import {

  VendorKitchenOrderCard,

  buildKitchenOperatingMode,

} from "./VendorKitchenOrderCard";



const NewOrderSoundAlert = dynamic(

  () => import("../dashboard/NewOrderSoundAlert").then((m) => m.NewOrderSoundAlert),

  { ssr: false }

);



const NEW_ORDER_PULSE_MS = 12_000;

const CARD_HIGHLIGHT_MS = 60_000;



export function VendorKitchenBoard({

  vendorId,

  vendorName,

  initialVendorOrders,

  initialNowMs,

  isDeliverectLive,

  orderRoutingMode,

  vendorDeliverectChannelLinkId,

  ordersPaused,

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

  posWarning: string | null;

}) {

  const [intakePaused, setIntakePaused] = useState(ordersPaused);

  const [newOrderPulse, setNewOrderPulse] = useState(false);

  const [highlightExpireAtById, setHighlightExpireAtById] = useState<Record<string, number>>({});

  const [, setHighlightTick] = useState(0);

  const seenOrderIdsRef = useRef<Set<string>>(new Set(initialVendorOrders.map((vo) => vo.id)));



  const { vendorOrders, nowMs, onStatusSuccess, fetchError, refresh, isPolling, lastFetchedAtMs } =

    useVendorOrdersPoll({

      vendorId,

      initialOrders: initialVendorOrders,

      initialNowMs,

    });



  const grouped = useMemo(() => groupVendorOrdersForBoard(vendorOrders), [vendorOrders]);

  const counts = useMemo(() => countActiveBoardGroups(grouped), [grouped]);

  const newOrderIdsForSound = grouped.new.map((vo) => vo.id);



  useEffect(() => {

    setIntakePaused(ordersPaused);

  }, [ordersPaused]);



  useEffect(() => {

    const id = setInterval(() => setHighlightTick((tick) => tick + 1), 3000);

    return () => clearInterval(id);

  }, []);



  useEffect(() => {

    const seen = seenOrderIdsRef.current;

    const newIds = grouped.new.filter((vo) => !seen.has(vo.id)).map((vo) => vo.id);

    if (newIds.length === 0) return;



    newIds.forEach((id) => seen.add(id));

    const expiresAt = Date.now() + CARD_HIGHLIGHT_MS;

    setHighlightExpireAtById((prev) => {

      const next = { ...prev };

      for (const id of newIds) next[id] = expiresAt;

      return next;

    });

    setNewOrderPulse(true);

    const timer = setTimeout(() => setNewOrderPulse(false), NEW_ORDER_PULSE_MS);

    return () => clearTimeout(timer);

  }, [grouped.new]);



  const highlightNow = Date.now();



  return (

    <div className="flex min-h-dvh flex-col">

      <NewOrderSoundAlert newOrderIds={newOrderIdsForSound} />



      <VendorKitchenHeader

        vendorId={vendorId}

        vendorName={vendorName}

        orderRoutingMode={orderRoutingMode}

        intakePaused={intakePaused}

        onIntakePausedChange={setIntakePaused}

        posWarning={posWarning}

        lastFetchedAtMs={lastFetchedAtMs}

        nowMs={nowMs}

        fetchError={fetchError}

      />



      {newOrderPulse && counts.new > 0 ? (

        <div

          className="border-b border-brand/30 bg-brand/10 px-4 py-2 text-center text-sm font-semibold text-brand sm:px-6"

          role="status"

        >

          New order received — check the New column

        </div>

      ) : null}



      {fetchError ? (

        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">

          <span>{fetchError}</span>

          <button

            type="button"

            onClick={() => void refresh()}

            className="min-h-[44px] rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900"

          >

            Retry

          </button>

        </div>

      ) : null}



      {isPolling && vendorOrders.length === 0 && !fetchError ? (

        <p className="px-4 py-6 text-center text-sm text-oo-stone-gray sm:px-6">Loading orders…</p>

      ) : null}



      <main className="min-h-0 flex-1 px-3 py-4 sm:px-6 sm:py-5">

        <div className="mx-auto grid h-full max-w-[1600px] gap-4 lg:grid-cols-3 lg:gap-5">

          {VENDOR_ORDERS_ACTIVE_BOARD_GROUPS.map((columnKey) => {

            const list = grouped[columnKey];

            const hasNewOrders = columnKey === "new" && list.length > 0;



            return (

              <section

                key={columnKey}

                className={`flex min-h-[220px] min-w-0 flex-col rounded-2xl border p-3 sm:min-h-[280px] sm:p-4 lg:max-h-[calc(100dvh-11rem)] ${

                  hasNewOrders

                    ? "border-brand/35 bg-brand/[0.04] shadow-sm ring-1 ring-brand/15"

                    : "border-oo-light-stone/80 bg-oo-warm-white/60"

                }`}

              >

                <h2

                  className={`sticky top-0 z-10 -mx-1 rounded-lg px-2 py-2 text-base font-bold sm:text-lg ${

                    hasNewOrders ? "bg-brand/10 text-brand" : "bg-oo-warm-white/95 text-oo-charcoal"

                  }`}

                >

                  {KITCHEN_COLUMN_LABELS[columnKey]}

                  <span

                    className={`ml-2 inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${

                      hasNewOrders ? "bg-brand text-white" : "bg-oo-cream text-oo-charcoal"

                    }`}

                  >

                    {list.length}

                  </span>

                </h2>



                {list.length === 0 ? (

                  <p className="mt-2 flex flex-1 items-center justify-center rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/30 px-3 py-8 text-center text-sm text-oo-stone-gray">

                    {KITCHEN_COLUMN_EMPTY[columnKey]}

                  </p>

                ) : (

                  <ul className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-1 pt-1">

                    {list.map((vo) => {

                      const effective = getVendorOrderEffectiveDisplayState(vo, vo.statusHistory);

                      const needsAttention = effective === "needs_attention";

                      const isNewHighlight = (highlightExpireAtById[vo.id] ?? 0) > highlightNow;



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

                            isNewHighlight={isNewHighlight}

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



        <p className="mx-auto mt-6 max-w-[1600px] text-center text-xs text-oo-stone-gray sm:text-sm">

          Completed and cancelled orders are on the{" "}

          <Link

            href={`/vendor/${vendorId}/orders`}

            className="font-semibold text-brand hover:underline"

          >

            Orders page

          </Link>

          .

        </p>

      </main>

    </div>

  );

}


