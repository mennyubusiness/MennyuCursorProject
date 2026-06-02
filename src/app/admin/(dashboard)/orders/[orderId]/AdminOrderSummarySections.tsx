import Link from "next/link";
import { getPickupCode } from "@/lib/pickup-code";
import {
  ADMIN_SECTION_CARD,
  formatAdminMoney,
  formatAdminOrderDate,
  fulfillmentStatusBadge,
  parentStatusBadgeClass,
  parentStatusDisplay,
  routingStatusBadge,
} from "@/lib/admin-order-detail-ui";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";

export function AdminOrderDetailHeader({
  orderId,
  createdAt,
  status,
  vendorOrders,
  totalCents,
  paymentRefundStatus,
}: {
  orderId: string;
  createdAt: Date;
  status: string;
  vendorOrders: AdminOrderDetail["vendorOrders"];
  totalCents: number;
  paymentRefundStatus?: string | null;
}) {
  const shortId = orderId.slice(-8).toUpperCase();
  const statusLabel = parentStatusDisplay(status, vendorOrders);
  const paymentChip =
    status === "pending_payment"
      ? { label: "Payment pending", className: "bg-amber-100 text-amber-900" }
      : paymentRefundStatus === "fully_refunded"
        ? { label: "Refunded", className: "bg-stone-200 text-stone-700" }
        : paymentRefundStatus === "partially_refunded"
          ? { label: "Partial refund", className: "bg-amber-100 text-amber-900" }
          : { label: "Paid", className: "bg-emerald-100 text-emerald-900" };

  const fulfillmentChip = (() => {
    const allDone = vendorOrders.every((v) => v.fulfillmentStatus === "completed");
    if (allDone) return { label: "Completed", className: "bg-emerald-100 text-emerald-900" };
    const failed = vendorOrders.some((v) => v.routingStatus === "failed" && v.fulfillmentStatus === "pending");
    if (failed) return { label: "Routing failed", className: "bg-red-100 text-red-900" };
    const recovered = vendorOrders.some((v) => v.manuallyRecoveredAt != null);
    if (recovered) return { label: "Recovered", className: "bg-emerald-100 text-emerald-900" };
    return { label: "In progress", className: "bg-blue-100 text-blue-900" };
  })();

  return (
    <header className="space-y-3">
      <Link href="/admin/orders" className="text-sm text-oo-stone-gray hover:underline">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-oo-charcoal">Order #{shortId}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${parentStatusBadgeClass(status)}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-oo-stone-gray">{formatAdminOrderDate(createdAt)}</p>
        </div>
        <Link
          href={`/order/${orderId}`}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm text-oo-charcoal hover:bg-oo-cream/80"
        >
          Customer tracking →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentChip.className}`}>
          {paymentChip.label}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${fulfillmentChip.className}`}>
          {fulfillmentChip.label}
        </span>
        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-800">
          {vendorOrders.length} vendor{vendorOrders.length === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-800">
          {formatAdminMoney(totalCents)} total
        </span>
      </div>
    </header>
  );
}

export function AdminOrderSummaryCard({
  adminOrder,
  paymentRefundStatus,
}: {
  adminOrder: AdminOrderDetail;
  paymentRefundStatus?: string | null;
}) {
  const pickupCode = getPickupCode(adminOrder.id);
  const paymentLabel =
    adminOrder.status === "pending_payment"
      ? "Pending payment"
      : paymentRefundStatus === "fully_refunded"
        ? "Fully refunded"
        : paymentRefundStatus === "partially_refunded"
          ? "Partially refunded"
          : "Paid";

  return (
    <section className={ADMIN_SECTION_CARD}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Summary</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Customer email</dt>
            <dd className="text-right text-oo-charcoal">{adminOrder.customerEmail ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Customer phone</dt>
            <dd className="text-right text-oo-charcoal">{adminOrder.customerPhone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Pod</dt>
            <dd className="text-right text-oo-charcoal">{adminOrder.pod.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Pickup code</dt>
            <dd className="font-mono font-semibold text-oo-charcoal">{pickupCode}</dd>
          </div>
          {adminOrder.orderNotes && (
            <div>
              <dt className="text-oo-stone-gray">Checkout notes</dt>
              <dd className="mt-0.5 text-oo-charcoal">{adminOrder.orderNotes}</dd>
            </div>
          )}
        </dl>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Subtotal</dt>
            <dd className="tabular-nums text-oo-charcoal">
              {formatAdminMoney(adminOrder.subtotalCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Total</dt>
            <dd className="font-semibold tabular-nums text-oo-charcoal">
              {formatAdminMoney(adminOrder.totalCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Order status</dt>
            <dd className="text-right text-oo-charcoal">
              {parentStatusDisplay(adminOrder.status, adminOrder.vendorOrders)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Payment</dt>
            <dd className="text-right text-oo-charcoal">{paymentLabel}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 border-t border-oo-light-stone pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Vendor summary
        </h3>
        <ul className="mt-2 space-y-2">
          {adminOrder.vendorOrders.map((vo) => {
            const routing = routingStatusBadge(vo.routingStatus);
            const fulfillment = fulfillmentStatusBadge(vo.fulfillmentStatus);
            return (
              <li
                key={vo.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-oo-light-stone/80 bg-oo-cream/30 px-3 py-2 text-sm"
              >
                <span className="font-medium text-oo-charcoal">{vo.vendor.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${fulfillment.className}`}>
                    {fulfillment.label}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${routing.className}`}>
                    {routing.label}
                  </span>
                  <span className="tabular-nums text-xs text-oo-stone-gray">
                    {formatAdminMoney(vo.totalCents)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
