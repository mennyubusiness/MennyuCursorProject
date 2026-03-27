"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { getOrderStatusAction } from "@/actions/order.actions";
import { isTerminalStatus } from "@/domain/order-state";
import { getPickupCode } from "@/lib/pickup-code";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { canCustomerCancelOrder, canCustomerCancelVendorOrder } from "@/lib/cancel-eligibility";
import { SetCustomerPhoneFromOrder } from "./SetCustomerPhoneFromOrder";
import { OrderCancelButton } from "./OrderCancelButton";
import { VendorOrderCancelButton } from "./VendorOrderCancelButton";
import { formatPickupDetailLine } from "@/lib/pickup-display";
import {
  vendorStatusLabel,
  orderSummaryExplanation,
  buildTimelineEvents,
  formatTimestamp,
  refundDisplayMessage,
  customerStatusLabel,
} from "./order-status-helpers";

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
  return {
    ...order,
    requestedPickupAt: requested,
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
  } as NonNullable<OrderFromApi>;
}

const POLL_INTERVAL_MS = 4000;

function orderStatusFingerprint(o: NonNullable<OrderFromApi>): string {
  const d = o.derivedStatus ?? o.status;
  const vos = (o.vendorOrders ?? [])
    .map((vo) => `${vo.id}:${vo.routingStatus}:${vo.fulfillmentStatus}`)
    .join("|");
  const hist = (o.statusHistory ?? []).length;
  const refunds = (o.refundAttempts ?? []).length;
  return `${d}|${vos}|${hist}|${refunds}|${o.totalCents}`;
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
        const fp = orderStatusFingerprint(next);
        if (fp === lastFingerprintRef.current) return;
        lastFingerprintRef.current = fp;
        setOrder(normalizeOrderDates(next));
        const nextDerived = next.derivedStatus ?? next.status;
        if (isTerminalStatus(nextDerived as Parameters<typeof isTerminalStatus>[0])) {
          clearPoll();
        }
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
  const statusLabel = customerStatusLabel(derivedStatus, order.vendorOrders, failedButRecoverable);
  const explanation = orderSummaryExplanation(derivedStatus, order.vendorOrders);
  const timelineEvents = buildTimelineEvents(order);
  const pickupCode = getPickupCode(order.id);
  const pickupLine = formatPickupDetailLine(
    order.requestedPickupAt,
    order.resolvedPickupTimezone
  );
  const isMultiVendor = order.vendorOrders.length > 1;
  const customerCanCancel = canCustomerCancelOrder(order);
  const isOrderCancelled = derivedStatus === "cancelled";
  const latestRefundAttempt = order.refundAttempts?.[0] ?? null;
  const refundMessage = refundDisplayMessage(latestRefundAttempt);
  const readyCount = order.vendorOrders.filter((vo) => vo.fulfillmentStatus === "ready").length;
  const completedCount = order.vendorOrders.filter((vo) => vo.fulfillmentStatus === "completed").length;

  return (
    <div className="max-w-2xl">
      <SetCustomerPhoneFromOrder customerPhone={order.customerPhone} />
      {from === "cart" && (
        <p className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-700">
          You already have an active order. Here&apos;s your order status.
        </p>
      )}
      <h1 className="text-2xl font-semibold text-stone-900">Your order</h1>
      <p className="mt-1 text-stone-600">Order #{order.id.slice(-8).toUpperCase()}</p>

      <p className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
        {pickupLine}
      </p>

      <section className="mt-6 rounded-xl border-2 border-stone-300 bg-stone-50 p-6" aria-label="Pickup code">
        <p className="text-sm font-medium uppercase tracking-wide text-stone-500">Pickup code</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-[0.25em] text-stone-900">
          {pickupCode}
        </p>
        <p className="mt-3 text-sm text-stone-600">
          Show this code at pickup. Give it to the vendor when you collect your order.
        </p>
      </section>

      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-sm font-medium text-stone-800">At pickup</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
          <li>Show your pickup code at pickup.</li>
          <li>Check each vendor section below for readiness.</li>
          {isMultiVendor && (
            <li>Items from different vendors may be ready at different times.</li>
          )}
        </ul>
      </div>

      {isMultiVendor && (readyCount > 0 || completedCount > 0) && (
        <p className="mt-3 text-sm text-stone-700">
          {readyCount + completedCount === order.vendorOrders.length ? (
            "All vendor orders are ready or picked up."
          ) : (
            <>
              {readyCount + completedCount} of {order.vendorOrders.length} vendor{" "}
              {order.vendorOrders.length === 1 ? "order" : "orders"} ready or picked up.
            </>
          )}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-lg font-medium text-mennyu-primary">{statusLabel}</p>
        <p className="mt-2 text-sm text-stone-600">{explanation}</p>
        {isOrderCancelled && refundMessage && (
          <p className="mt-2 text-sm font-medium text-stone-700">{refundMessage.line}</p>
        )}
        <p className="mt-3 text-xs text-stone-500">
          Updates will be sent to {order.customerPhone}.
        </p>
      </div>

      <section className="mt-8" aria-label="Vendor order status">
        <h2 className="text-lg font-semibold text-stone-900">Where your order is at</h2>
        {isMultiVendor && (
          <p className="mt-1 text-sm text-stone-600">
            This order has {order.vendorOrders.length} vendors. Items may be ready at different times.
          </p>
        )}
        {!isMultiVendor && (
          <p className="mt-1 text-sm text-stone-500">Status for your vendor.</p>
        )}
        {order.vendorOrders.length > 1 && (
          <p className="mb-3 text-sm font-medium text-stone-700">By vendor</p>
        )}
        <div className="mt-4 space-y-5">
          {order.vendorOrders.map((vo) => {
            const isReady = vo.fulfillmentStatus === "ready";
            const isCancelled = vo.fulfillmentStatus === "cancelled";
            const recovered = isVendorOrderManuallyRecovered(vo, vo.statusHistory);
            const statusLabelVo = vendorStatusLabel(vo.routingStatus, vo.fulfillmentStatus, recovered);
            const canCancelThisVo = canCustomerCancelVendorOrder(vo);
            const showVendorSubtotal = order.vendorOrders.length > 1;
            return (
              <div
                key={vo.id}
                className={`rounded-xl border-2 p-4 ${
                  isCancelled
                    ? "border-stone-200 bg-stone-100/80"
                    : isReady
                      ? "border-emerald-500 bg-emerald-50/80"
                      : "border-stone-200 bg-stone-50"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-stone-900">{vo.vendor.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                      isCancelled
                        ? "bg-stone-300 text-stone-600"
                        : isReady
                          ? "bg-emerald-600 text-white"
                          : "bg-stone-200 text-stone-800"
                    }`}
                  >
                    {statusLabelVo}
                  </span>
                </div>
                {isReady && !isCancelled && (
                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    This vendor&apos;s portion is ready for pickup.
                  </p>
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
                {showVendorSubtotal && (
                  <div className="mt-3 border-t border-stone-200 pt-3">
                    <p className="text-sm font-medium text-stone-800">
                      Vendor subtotal{" "}
                      <span className="font-semibold tabular-nums">
                        ${(vo.totalCents / 100).toFixed(2)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">Food items from this vendor only</p>
                  </div>
                )}
                {canCancelThisVo && (
                  <VendorOrderCancelButton
                    orderId={orderId}
                    vendorOrderId={vo.id}
                    vendorName={vo.vendor.name}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 rounded-xl border-2 border-stone-300 bg-stone-50 p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Order total</h3>
        <p className="mt-1 text-xs text-stone-500">
          {order.vendorOrders.length > 1
            ? "Combined across all vendors, fees, and tip."
            : "What you paid for this order."}
        </p>
        <dl className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Subtotal</dt>
            <dd className="tabular-nums text-stone-900">${(order.subtotalCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Service fee</dt>
            <dd className="tabular-nums text-stone-900">${(order.serviceFeeCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Tax</dt>
            <dd className="tabular-nums text-stone-900">${((order.taxCents ?? 0) / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Tip</dt>
            <dd className="tabular-nums text-stone-900">${(order.tipCents / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-3 text-base font-bold text-stone-900">
            <dt>Total</dt>
            <dd className="tabular-nums">${(order.totalCents / 100).toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      {!isOrderCancelled && (
        <OrderCancelButton
          orderId={orderId}
          disabled={!customerCanCancel}
          disabledMessage={
            !customerCanCancel
              ? "This order can no longer be cancelled because preparation has started."
              : undefined
          }
        />
      )}

      {timelineEvents.length > 0 && (
        <section className="mt-8" aria-label="Order updates">
          <h2 className="text-lg font-semibold text-stone-900">Recent updates</h2>
          <p className="mt-1 text-sm text-stone-500">
            Latest activity on your order, newest at the bottom.
          </p>
          <ul className="mt-3 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
            {timelineEvents.map((evt, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-2 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
              >
                <time
                  dateTime={evt.createdAt.toISOString()}
                  className="text-xs text-stone-500 shrink-0"
                >
                  {formatTimestamp(evt.createdAt)}
                </time>
                <span className="text-sm text-stone-800">{evt.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
