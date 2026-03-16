import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getOrderStatusAction,
  reconcilePaymentIfSucceededAction,
  clearCartAfterOrderSuccessAction,
} from "@/actions/order.actions";
import { parentStatusLabel } from "@/domain/order-state";
import { getPickupCode } from "@/lib/pickup-code";
import { isVendorOrderManuallyRecovered } from "@/lib/vendor-order-effective-state";
import { canCustomerCancelOrder, canCustomerCancelVendorOrder } from "@/lib/cancel-eligibility";
import { SetCustomerPhoneFromOrder } from "./SetCustomerPhoneFromOrder";
import { OrderPageLivePoller } from "./OrderPageLivePoller";
import { OrderCancelButton } from "./OrderCancelButton";
import { VendorOrderCancelButton } from "./VendorOrderCancelButton";

/**
 * Customer-facing status label for a single vendor order.
 * Recoverable routing failure: do not show "Unavailable" if manually recovered.
 */
function vendorStatusLabel(
  routingStatus: string,
  fulfillmentStatus: string,
  isManuallyRecovered?: boolean
): string {
  if (routingStatus === "failed" && !isManuallyRecovered) return "Unavailable";
  const fulfillmentLabels: Record<string, string> = {
    pending: "Order received",
    accepted: "Order received",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Picked up",
    cancelled: "Cancelled",
  };
  const label = fulfillmentLabels[fulfillmentStatus];
  if (label) return label;
  if (routingStatus === "sent" || routingStatus === "confirmed") return "Order received";
  return "In progress";
}

/** Short explanatory sentence for the top summary (reflects mixed vendor states). */
function orderSummaryExplanation(
  derivedStatus: string,
  vendorOrders: Array<{ fulfillmentStatus: string; routingStatus: string }>
): string {
  const ready = vendorOrders.filter((v) => v.fulfillmentStatus === "ready").length;
  const preparing = vendorOrders.filter((v) =>
    ["accepted", "preparing"].includes(v.fulfillmentStatus)
  ).length;
  const completed = vendorOrders.filter((v) => v.fulfillmentStatus === "completed").length;
  const total = vendorOrders.length;

  if (derivedStatus === "completed") {
    return "Your order is complete. Thank you!";
  }
  if (derivedStatus === "ready") {
    if (total === 1) return "Your order is ready for pickup.";
    return "Your order is ready for pickup.";
  }
  if (derivedStatus === "in_progress") {
    if (ready > 0 && preparing > 0) {
      return `${ready} ${ready === 1 ? "vendor has" : "vendors have"} your items ready; ${preparing} ${preparing === 1 ? "is" : "are"} still preparing.`;
    }
    if (ready > 0) return "Your items are ready for pickup.";
    return "We're preparing your order with our vendors.";
  }
  if (derivedStatus === "partially_completed") {
    return "Part of your order is complete; we'll update you on the rest.";
  }
  if (["routing", "routed", "routed_partial"].includes(derivedStatus)) {
    return "We've sent your order to the vendors. You'll get updates as they confirm.";
  }
  if (derivedStatus === "paid" || derivedStatus === "pending_payment") {
    return "We're getting your order to the vendors.";
  }
  if (derivedStatus === "failed") {
    const allRecoverable =
      vendorOrders.length > 0 &&
      vendorOrders.every(
        (v) =>
          v.fulfillmentStatus === "cancelled" ||
          (v.routingStatus === "failed" && v.fulfillmentStatus === "pending")
      );
    if (allRecoverable)
      return "We're confirming your order. We'll update you shortly.";
    return "We couldn't complete this order. Contact us if you need help.";
  }
  if (derivedStatus === "cancelled") return "This order was cancelled.";
  return "We'll send updates to your phone as things progress.";
}

/** Label for one timeline entry (customer-facing; no "order" or "routing" in text). */
function timelineEntryLabel(
  vendorName: string | null,
  routingStatus: string | null,
  fulfillmentStatus: string | null,
  orderStatus?: string
): string {
  if (orderStatus !== undefined) {
    return parentStatusLabel(orderStatus as Parameters<typeof parentStatusLabel>[0]);
  }
  const fulfillmentLabels: Record<string, string> = {
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const routingLabels: Record<string, string> = {
    sent: "Sent to vendor",
    confirmed: "Confirmed",
    failed: "Unavailable",
  };
  const part =
    (fulfillmentStatus && fulfillmentLabels[fulfillmentStatus]) ??
    (routingStatus && routingLabels[routingStatus]) ??
    "Updated";
  return vendorName ? `${vendorName} — ${part}` : part;
}

type TimelineEvent = {
  createdAt: Date;
  label: string;
};

/** Internal event with type so we can filter/collapse before showing. */
type InternalTimelineEvent = TimelineEvent & { type: "order" | "vendor" };

/**
 * Build customer-facing timeline: hide noisy events, collapse duplicate order labels,
 * preserve chronological order. Does not change backend or history data.
 * Includes refund-issued entry when latest RefundAttempt succeeded.
 */
function buildTimelineEvents(order: {
  statusHistory: Array<{ status: string; createdAt: Date }>;
  vendorOrders: Array<{
    vendor: { name: string };
    statusHistory: Array<{
      routingStatus: string | null;
      fulfillmentStatus: string | null;
      createdAt: Date;
    }>;
  }>;
  refundAttempts?: Array<{ status: string; amountCents: number; createdAt: Date }>;
}): TimelineEvent[] {
  const raw: InternalTimelineEvent[] = [];

  for (const e of order.statusHistory) {
    raw.push({
      createdAt: e.createdAt,
      label: timelineEntryLabel(null, null, null, e.status),
      type: "order",
    });
  }
  const latestRefund = order.refundAttempts?.[0];
  if (latestRefund?.status === "succeeded") {
    raw.push({
      createdAt: latestRefund.createdAt,
      label: `Refund of $${(latestRefund.amountCents / 100).toFixed(2)} issued`,
      type: "order",
    });
  }
  for (const vo of order.vendorOrders) {
    for (const e of vo.statusHistory) {
      const label = timelineEntryLabel(
        vo.vendor.name,
        e.routingStatus,
        e.fulfillmentStatus
      );
      if (label.endsWith(" — Confirmed")) continue;
      raw.push({ createdAt: e.createdAt, label, type: "vendor" });
    }
  }
  raw.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const filtered: TimelineEvent[] = [];
  const orderLabelsSeen = new Set<string>();
  for (const evt of raw) {
    if (evt.type === "order") {
      if (evt.label === "In progress") continue;
      if (orderLabelsSeen.has(evt.label)) continue;
      orderLabelsSeen.add(evt.label);
    }
    filtered.push({ createdAt: evt.createdAt, label: evt.label });
  }
  return filtered;
}

function formatTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Customer-facing refund message from latest RefundAttempt; null if none or not relevant. */
function refundDisplayMessage(
  latestAttempt: { status: string; amountCents: number; createdAt: Date } | null | undefined
): { line: string; timelineLabel?: string } | null {
  if (!latestAttempt) return null;
  const amountFormatted = `$${(latestAttempt.amountCents / 100).toFixed(2)}`;
  if (latestAttempt.status === "succeeded") {
    return {
      line: `Refunded. Refund of ${amountFormatted} issued.`,
      timelineLabel: `Refund of ${amountFormatted} issued`,
    };
  }
  if (latestAttempt.status === "attempted") return { line: "Refund pending.", timelineLabel: undefined };
  if (latestAttempt.status === "failed") return { line: "Refund issue — under review.", timelineLabel: undefined };
  return null;
}

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string; payment?: string }>;
}) {
  const { orderId } = await params;
  const { from, payment } = await searchParams;
  let order = await getOrderStatusAction(orderId);
  if (!order) notFound();
  if (payment === "success" && order.status === "pending_payment") {
    await reconcilePaymentIfSucceededAction(orderId);
    order = (await getOrderStatusAction(orderId)) ?? order;
  }

  if (payment === "success" && order.status !== "pending_payment") {
    const cookieStore = await cookies();
    const checkoutCookie = cookieStore.get("mennyu_checkout")?.value;
    if (checkoutCookie) {
      try {
        const { orderId: cookieOrderId, cartId } = JSON.parse(decodeURIComponent(checkoutCookie)) as {
          orderId?: string;
          cartId?: string;
        };
        if (cookieOrderId === orderId && cartId) {
          await clearCartAfterOrderSuccessAction(cartId);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  const derivedStatus = order.derivedStatus ?? order.status;
  const failedButRecoverable =
    derivedStatus === "failed" &&
    order.vendorOrders.length > 0 &&
    order.vendorOrders.every(
      (v) =>
        v.fulfillmentStatus === "cancelled" ||
        (v.routingStatus === "failed" && v.fulfillmentStatus === "pending")
    );
  const statusLabel = failedButRecoverable
    ? "Confirming your order"
    : (order.statusLabel ?? order.derivedStatus ?? order.status);
  const explanation = orderSummaryExplanation(derivedStatus, order.vendorOrders);
  const timelineEvents = buildTimelineEvents(order);
  const pickupCode = getPickupCode(order.id);
  const isMultiVendor = order.vendorOrders.length > 1;
  const customerCanCancel = canCustomerCancelOrder(order);
  const isOrderCancelled = derivedStatus === "cancelled";
  const latestRefundAttempt = order.refundAttempts?.[0] ?? null;
  const refundMessage = refundDisplayMessage(latestRefundAttempt);
  const readyCount = order.vendorOrders.filter((vo) => vo.fulfillmentStatus === "ready").length;
  const completedCount = order.vendorOrders.filter((vo) => vo.fulfillmentStatus === "completed").length;

  return (
    <div className="max-w-2xl">
      <OrderPageLivePoller orderId={orderId} initialDerivedStatus={derivedStatus} />
      <SetCustomerPhoneFromOrder customerPhone={order.customerPhone} />
      {from === "cart" && (
        <p className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-700">
          You already have an active order. Here’s your order status.
        </p>
      )}
      <h1 className="text-2xl font-semibold text-stone-900">Your order</h1>
      <p className="mt-1 text-stone-600">Order #{order.id.slice(-8).toUpperCase()}</p>

      {/* Pickup code: prominent card */}
      <section className="mt-6 rounded-xl border-2 border-stone-300 bg-stone-50 p-6" aria-label="Pickup code">
        <p className="text-sm font-medium uppercase tracking-wide text-stone-500">Pickup code</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-[0.25em] text-stone-900">
          {pickupCode}
        </p>
        <p className="mt-3 text-sm text-stone-600">
          Show this code at pickup. Give it to the vendor when you collect your order.
        </p>
      </section>

      {/* Pickup guidance */}
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

      {/* Optional: vendor-ready summary */}
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

      {/* Overall status */}
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

      {/* Vendor sections */}
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
        <div className="mt-4 space-y-5">
          {order.vendorOrders.map((vo) => {
            const isReady = vo.fulfillmentStatus === "ready";
            const isCancelled = vo.fulfillmentStatus === "cancelled";
            const recovered = isVendorOrderManuallyRecovered(vo, vo.statusHistory);
            const statusLabelVo = vendorStatusLabel(vo.routingStatus, vo.fulfillmentStatus, recovered);
            const canCancelThisVo = canCustomerCancelVendorOrder(vo);
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
                <ul className="mt-3 space-y-1.5 text-sm text-stone-600">
                  {vo.lineItems.map((line) => (
                    <li key={line.id}>
                      {line.name} × {line.quantity} — ${((line.priceCents * line.quantity) / 100).toFixed(2)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-stone-500">
                  Subtotal: ${(vo.totalCents / 100).toFixed(2)}
                </p>
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

      {/* Totals */}
      <div className="mt-6 rounded-lg border border-stone-200 p-4">
        <p className="text-stone-600">Subtotal: ${(order.subtotalCents / 100).toFixed(2)}</p>
        <p className="text-stone-600">Service fee: ${(order.serviceFeeCents / 100).toFixed(2)}</p>
        <p className="text-stone-600">Tip: ${(order.tipCents / 100).toFixed(2)}</p>
        <p className="mt-2 font-medium text-stone-900">
          Total: ${(order.totalCents / 100).toFixed(2)}
        </p>
      </div>

      {/* Customer cancel: only when order is still in early, cancelable state */}
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

      {/* Bottom: single chronological timeline */}
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
