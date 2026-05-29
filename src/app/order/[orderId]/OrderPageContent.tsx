"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { getOrderStatusAction } from "@/actions/order.actions";
import { isTerminalStatus } from "@/domain/order-state";
import { getPickupCode } from "@/lib/pickup-code";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { formatOrderStatusTimelineClock, formatPickupDetailLine } from "@/lib/pickup-display";
import {
  vendorStatusLabelForScheduledPickup,
  buildTimelineEvents,
  refundDisplayMessage,
  customerOrderStatusCardCopy,
} from "./order-status-helpers";
import { buildParentOrderProgressSteps, getVendorCustomerStage } from "./customer-order-progress";
import { CustomerOrderProgressTimeline } from "./CustomerOrderProgressTimeline";
import { VendorCustomerStatusStrip } from "./VendorCustomerStatusStrip";
import { mergeCustomerOrderPollPatch } from "./merge-customer-order-poll";
import { OrderHelpSection } from "./OrderHelpSection";
import { OrderPostCheckoutCartSync } from "./OrderPostCheckoutCartSync";

/** Order as returned by status API / server (dates may be ISO strings after JSON). */
type OrderFromApi = Awaited<ReturnType<typeof getOrderStatusAction>>;

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v as string);
}

/** Normalize order so all createdAt fields are Date for timeline/display. */
function normalizeOrderDates(order: NonNullable<OrderFromApi>): NonNullable<OrderFromApi> {
  const requested =
    order.requestedPickupAt != null
      ? toDate(order.requestedPickupAt as string | Date)
      : null;
  const estimated =
    order.deliverectEstimatedReadyAt != null
      ? toDate(order.deliverectEstimatedReadyAt as string | Date)
      : null;
  return {
    ...order,
    requestedPickupAt: requested,
    deliverectEstimatedReadyAt: estimated,
    statusHistory: (order.statusHistory ?? []).map((e) => ({
      ...e,
      createdAt: toDate(e.createdAt as string | Date),
    })),
    vendorOrders: (order.vendorOrders ?? []).map((vo) => ({
      ...vo,
      statusHistory: (vo.statusHistory ?? []).map((h) => ({
        ...h,
        createdAt: toDate(h.createdAt as string | Date),
      })),
    })),
    refundAttempts: (order.refundAttempts ?? []).map((r) => ({
      ...r,
      createdAt: toDate(r.createdAt as string | Date),
    })),
    orderRefunds: (order.orderRefunds ?? []).map((r) => ({
      ...r,
      createdAt: toDate(r.createdAt as string | Date),
    })),
  } as NonNullable<OrderFromApi>;
}

const POLL_INTERVAL_MS = 4000;

function orderStatusFingerprint(o: NonNullable<OrderFromApi>): string {
  const d = o.derivedStatus ?? o.status;
  const vos = (o.vendorOrders ?? [])
    .map((vo) => `${vo.id}:${vo.routingStatus}:${vo.fulfillmentStatus}`)
    .join("|");
  const hist = (o.statusHistory ?? []).length;
  const refunds = (o.refundAttempts ?? []).length + (o.orderRefunds ?? []).length;
  const eta =
    o.deliverectEstimatedReadyAt != null
      ? toDate(o.deliverectEstimatedReadyAt as string | Date).toISOString()
      : "";
  return `${d}|${vos}|${hist}|${refunds}|${o.totalCents}|${eta}`;
}

export function OrderPageContent({
  initialOrder,
  orderId,
  from,
}: {
  initialOrder: NonNullable<OrderFromApi>;
  orderId: string;
  from?: string;
}) {
  const [order, setOrder] = useState<NonNullable<OrderFromApi>>(() =>
    normalizeOrderDates(initialOrder)
  );
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>(orderStatusFingerprint(initialOrder));

  useEffect(() => {
    const derived = order.derivedStatus ?? order.status;
    if (isTerminalStatus(derived as Parameters<typeof isTerminalStatus>[0])) {
      return;
    }

    function clearPoll() {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as NonNullable<OrderFromApi>;
        let becameTerminal = false;
        setOrder((prev) => {
          const merged = mergeCustomerOrderPollPatch(prev, next);
          const fp = orderStatusFingerprint(merged);
          if (fp === lastFingerprintRef.current) return prev;
          lastFingerprintRef.current = fp;
          const nextDerived = merged.derivedStatus ?? merged.status;
          becameTerminal = isTerminalStatus(nextDerived as Parameters<typeof isTerminalStatus>[0]);
          return normalizeOrderDates(merged);
        });
        if (becameTerminal) clearPoll();
      } catch {
        // ignore
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!intervalIdRef.current) {
          poll();
          intervalIdRef.current = setInterval(poll, POLL_INTERVAL_MS);
        }
      } else {
        clearPoll();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    poll();
    intervalIdRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearPoll();
    };
  }, [orderId]); // intentionally not depending on order so we keep polling until terminal

  const derivedStatus = order.derivedStatus ?? order.status;
  const failedButRecoverable =
    derivedStatus === "failed" &&
    order.vendorOrders.length > 0 &&
    order.vendorOrders.every(
      (v) =>
        v.fulfillmentStatus === "cancelled" ||
        (v.routingStatus === "failed" && v.fulfillmentStatus === "pending")
    );
  const statusCard = customerOrderStatusCardCopy({
    derivedStatus,
    vendorOrders: order.vendorOrders,
    failedButRecoverable,
    requestedPickupAt: order.requestedPickupAt,
    pickupDisplay: {
      requestedPickupAt: order.requestedPickupAt,
      deliverectEstimatedReadyAt: order.deliverectEstimatedReadyAt,
      resolvedPickupTimezone: order.resolvedPickupTimezone,
    },
  });
  const timelineEvents = buildTimelineEvents(order);
  const parentProgressSteps = buildParentOrderProgressSteps(
    derivedStatus,
    failedButRecoverable,
    order.vendorOrders
  );
  const pickupCode = getPickupCode(order.id);
  const pickupLine = formatPickupDetailLine({
    requestedPickupAt: order.requestedPickupAt,
    deliverectEstimatedReadyAt: order.deliverectEstimatedReadyAt,
    resolvedPickupTimezone: order.resolvedPickupTimezone,
  });
  const isMultiVendor = order.vendorOrders.length > 1;
  const isOrderCancelled = derivedStatus === "cancelled";
  const refundMessage = refundDisplayMessage({
    refundAttempts: order.refundAttempts,
    orderRefunds: order.orderRefunds,
    totalCents: order.totalCents,
    totalRefundedCents: order.totalRefundedCents,
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <OrderPostCheckoutCartSync
        orderId={orderId}
        podId={order.podId}
        orderStatus={order.status}
      />

      <header className="mb-6">
        {from === "cart" && (
          <p className="mb-4 rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-700">
            You already have an active order. Here&apos;s your order status.
          </p>
        )}
        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">Your order</h1>
        <p className="mt-1 text-stone-600">Order #{order.id.slice(-8).toUpperCase()}</p>
        <p className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
          {pickupLine}
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="order-1 min-w-0 lg:col-span-2">
          <section
            className="rounded-xl border-2 border-stone-300 bg-stone-50 p-5 sm:p-6"
            aria-label="Pickup code"
          >
            <p className="text-sm font-medium uppercase tracking-wide text-stone-500">Pickup code</p>
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-[0.25em] text-stone-900 sm:text-5xl">
              {pickupCode}
            </p>
            <p className="mt-3 text-sm text-stone-600">
              Show this code at pickup. Give it to the vendor when you collect your order.
            </p>
          </section>

          <section
            className="mt-6 rounded-2xl border border-stone-200/90 bg-gradient-to-b from-white to-stone-50/90 p-5 shadow-sm sm:p-6"
            aria-label="Order progress"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {statusCard.shortLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-stone-900 sm:text-2xl">
              {statusCard.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{statusCard.nextAction}</p>
            <div className="mt-5 border-t border-stone-100 pt-5">
              <CustomerOrderProgressTimeline steps={parentProgressSteps} />
            </div>
            {isOrderCancelled && refundMessage && (
              <p className="mt-4 text-sm font-medium text-stone-700">{refundMessage.line}</p>
            )}
          </section>

          <section className="mt-8" aria-label="Vendor order status">
            <h2 className="text-lg font-semibold text-stone-900">By vendor</h2>
            {isMultiVendor ? (
              <p className="mt-1 text-sm text-stone-600">
                This order has {order.vendorOrders.length} vendors. Items may be ready at different
                times.
              </p>
            ) : (
              <p className="mt-1 text-sm text-stone-500">Your items from this vendor</p>
            )}
            <div className="mt-4 space-y-4">
              {order.vendorOrders.map((vo) => {
                const isReady = vo.fulfillmentStatus === "ready";
                const isCompleted = vo.fulfillmentStatus === "completed";
                const isCancelled = vo.fulfillmentStatus === "cancelled";
                const isTerminalVo = isCompleted || isCancelled;
                const recovered = isVendorOrderManuallyRecovered(vo, vo.statusHistory);
                const vendorStage = getVendorCustomerStage(vo, recovered);
                const statusLabelVo = vendorStatusLabelForScheduledPickup(
                  order.requestedPickupAt,
                  vo.routingStatus,
                  vo.fulfillmentStatus,
                  recovered
                );
                const showVendorSubtotal = order.vendorOrders.length > 1;
                return (
                  <div
                    key={vo.id}
                    className={`rounded-xl border p-4 sm:p-5 ${
                      isCancelled
                        ? "border-stone-200 bg-stone-100/80"
                        : isReady
                          ? "border-emerald-300/80 bg-emerald-50/50"
                          : isCompleted
                            ? "border-stone-200 bg-stone-50/80"
                            : "border-stone-200/90 bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-stone-900">{vo.vendor.name}</h3>
                        {showVendorSubtotal && (
                          <p className="mt-0.5 text-sm tabular-nums text-stone-600">
                            Subtotal ${(vo.totalCents / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          isCancelled
                            ? "bg-stone-300 text-stone-600"
                            : isReady
                              ? "bg-emerald-600 text-white"
                              : isCompleted
                                ? "bg-stone-200 text-stone-700"
                                : "bg-stone-200 text-stone-800"
                        }`}
                      >
                        {statusLabelVo}
                      </span>
                    </div>

                    {!isTerminalVo && <VendorCustomerStatusStrip stage={vendorStage} />}

                    {isReady && !isCancelled && (
                      <p className="mt-2 text-sm font-medium text-emerald-800">
                        Ready for pickup — show your pickup code.
                      </p>
                    )}
                    {isCompleted && (
                      <p className="mt-2 text-sm text-stone-600">Picked up.</p>
                    )}

                    <ul className="mt-3 space-y-2 text-sm text-stone-600">
                      {vo.lineItems.map((line) => {
                        const selections = line.selections ?? [];
                        return (
                          <li key={line.id}>
                            <div>
                              {line.name} × {line.quantity} — $
                              {((line.priceCents * line.quantity) / 100).toFixed(2)}
                            </div>
                            {selections.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5 pl-3 text-stone-500">
                                {selections.map((s) => (
                                  <li key={s.id} className="flex gap-2">
                                    <span className="text-stone-400" aria-hidden>
                                      ·
                                    </span>
                                    <span>
                                      {s.quantity > 1
                                        ? `${s.nameSnapshot} ×${s.quantity}`
                                        : s.nameSnapshot}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="order-2 mt-0 space-y-6 lg:col-span-1 lg:row-span-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">At pickup</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Show your pickup code at pickup.</li>
              <li>Check each vendor section for readiness.</li>
              {isMultiVendor && (
                <li>Items from different vendors may be ready at different times.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Order total
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {order.vendorOrders.length > 1
                ? "Combined across all vendors, fees, and tip."
                : "What you paid for this order."}
            </p>
            <dl className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Subtotal</dt>
                <dd className="tabular-nums text-stone-900">
                  ${(order.subtotalCents / 100).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Service fee</dt>
                <dd className="tabular-nums text-stone-900">
                  ${(order.serviceFeeCents / 100).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Tax</dt>
                <dd className="tabular-nums text-stone-900">
                  ${((order.taxCents ?? 0) / 100).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Tip</dt>
                <dd className="tabular-nums text-stone-900">
                  ${(order.tipCents / 100).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-stone-200 pt-3 text-base font-bold text-stone-900">
                <dt>Total</dt>
                <dd className="tabular-nums">${(order.totalCents / 100).toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          <OrderHelpSection
            orderId={orderId}
            vendorOrders={order.vendorOrders.map((vo) => ({
              id: vo.id,
              vendorName: vo.vendor.name,
              lineItems: (vo.lineItems ?? []).map((line) => ({
                id: line.id,
                name: line.name,
              })),
            }))}
          />
        </aside>

        {timelineEvents.length > 0 && (
          <section
            className="order-3 min-w-0 lg:col-span-2"
            aria-label="Order updates"
          >
            <h2 className="text-lg font-semibold text-stone-900">Recent updates</h2>
            <p className="mt-1 text-sm text-stone-500">
              Activity on your order, oldest to newest.
            </p>
            <ul className="mt-3 max-h-72 space-y-0 overflow-y-auto rounded-xl border border-stone-200/90 bg-white p-3 shadow-sm sm:p-4">
              {timelineEvents.map((evt, i) => (
                <li
                  key={`${evt.label}-${evt.createdAt.toISOString()}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-stone-100 py-2.5 last:border-0 last:pb-0"
                >
                  <time
                    dateTime={evt.createdAt.toISOString()}
                    className="shrink-0 text-xs tabular-nums text-stone-500"
                  >
                    {formatOrderStatusTimelineClock(evt.createdAt, order.resolvedPickupTimezone)}
                  </time>
                  <span className="text-sm text-stone-800">{evt.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={`/dev/orders/${orderId}`} className="text-amber-700 hover:underline">
            Dev: Simulate lifecycle
          </Link>
        </div>
      )}
    </div>
  );
}
