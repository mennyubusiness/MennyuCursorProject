import Link from "next/link";
import { getPickupCode } from "@/lib/pickup-code";
import {
  ADMIN_SECTION_CARD,
  formatAdminMoney,
  formatAdminOrderDate,
  parentStatusBadgeClass,
  paymentChipClass,
  paymentChipLabel,
} from "@/lib/admin-order-detail-ui";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";
import { vendorClawbackStatusBadgeClass } from "@/lib/vendor-clawback-status";
import {
  formatAdminGroupOrderStatus,
  type AdminOrderGroupContext,
} from "@/lib/admin-order-group-context";
import type { AdminOrderOperationalSummary } from "@/lib/admin-order-operational-summary";
import { orderHasUnresolvedClawback } from "@/lib/admin-order-health";

function clawbackHeaderChip(summary: AdminOrderPaymentSummary | null): {
  label: string;
  className: string;
} | null {
  if (!summary || !orderHasUnresolvedClawback(summary)) return null;
  const relevant = summary.vendorOrders.filter(
    (v) => v.clawback.clawbackStatus !== "not_needed" && v.clawback.clawbackRequiredCents > 0
  );
  if (relevant.length === 0) return null;
  const worst = relevant.find((v) => v.clawback.clawbackStatus === "failed")
    ?? relevant.find((v) => v.legacyClawbackReview?.needsReview)
    ?? relevant.find((v) => v.clawback.clawbackStatus === "pending")
    ?? relevant.find((v) => v.clawback.hasMissingReversalSetup)
    ?? relevant[0];
  if (!worst) return null;
  return {
    label: worst.clawback.adminLabel.replace(/^Vendor clawback /i, "Clawback: "),
    className: vendorClawbackStatusBadgeClass(worst.clawback.clawbackStatus),
  };
}

export function AdminOrderDetailHeader({
  orderId,
  createdAt,
  status,
  totalCents,
  paymentRefundStatus,
  paymentSummary,
  groupOrderContext,
  operationalSummary,
}: {
  orderId: string;
  createdAt: Date;
  status: string;
  vendorOrders: AdminOrderDetail["vendorOrders"];
  totalCents: number;
  paymentRefundStatus?: string | null;
  paymentSummary?: AdminOrderPaymentSummary | null;
  groupOrderContext?: AdminOrderGroupContext | null;
  operationalSummary: AdminOrderOperationalSummary;
}) {
  const shortId = operationalSummary.shortRef;
  const statusLabel = operationalSummary.statusLabel;
  const clawbackChip = clawbackHeaderChip(paymentSummary ?? null);

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
            {groupOrderContext ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-950 ring-1 ring-sky-200/80">
                Group order
              </span>
            ) : null}
          </div>
          {operationalSummary.statusDetail ? (
            <p className="mt-1 text-sm text-oo-stone-gray">{operationalSummary.statusDetail}</p>
          ) : null}
          <p className="mt-1 text-sm text-oo-stone-gray">
            {formatAdminOrderDate(createdAt)}
            {" · "}
            {operationalSummary.vendorCount} vendor
            {operationalSummary.vendorCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/order/${orderId}`}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm text-oo-charcoal hover:bg-oo-cream/80"
        >
          Customer tracking →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentChipClass(status, paymentRefundStatus)}`}
        >
          {paymentChipLabel(status, paymentRefundStatus)}
        </span>
        {clawbackChip ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${clawbackChip.className}`}
          >
            {clawbackChip.label}
          </span>
        ) : null}
        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-800">
          {formatAdminMoney(totalCents)}
        </span>
      </div>
    </header>
  );
}

/** Customer and order basics — readable facts only (no vendor routing summary). */
export function AdminOrderBasicsCard({
  adminOrder,
  paymentRefundStatus,
  groupOrderContext,
}: {
  adminOrder: AdminOrderDetail;
  paymentRefundStatus?: string | null;
  groupOrderContext?: AdminOrderGroupContext | null;
}) {
  const pickupCode = getPickupCode(adminOrder.id);
  const paymentLabel = paymentChipLabel(adminOrder.status, paymentRefundStatus);

  return (
    <section className={ADMIN_SECTION_CARD}>
      <h2 className="text-sm font-semibold text-oo-charcoal">Customer &amp; order</h2>
      <p className="mt-0.5 text-xs text-oo-stone-gray">Core details for support and pickup.</p>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Customer email</dt>
          <dd className="text-oo-charcoal sm:mt-0.5">{adminOrder.customerEmail ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Phone</dt>
          <dd className="text-oo-charcoal sm:mt-0.5">{adminOrder.customerPhone}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Pod</dt>
          <dd className="text-oo-charcoal sm:mt-0.5">{adminOrder.pod.name}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Pickup code</dt>
          <dd className="font-mono font-semibold text-oo-charcoal sm:mt-0.5">{pickupCode}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Order time</dt>
          <dd className="text-oo-charcoal sm:mt-0.5">{formatAdminOrderDate(adminOrder.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Total</dt>
          <dd className="font-semibold tabular-nums text-oo-charcoal sm:mt-0.5">
            {formatAdminMoney(adminOrder.totalCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-oo-stone-gray">Refund status</dt>
          <dd className="text-oo-charcoal sm:mt-0.5">{paymentLabel}</dd>
        </div>
        {groupOrderContext ? (
          <>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-oo-stone-gray">Group code</dt>
              <dd className="font-mono font-semibold tracking-wider text-oo-charcoal sm:mt-0.5">
                {groupOrderContext.joinCode}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-oo-stone-gray">Group host</dt>
              <dd className="text-oo-charcoal sm:mt-0.5">
                {groupOrderContext.hostDisplayName}
                {groupOrderContext.hostUserEmail ? (
                  <span className="block text-xs text-oo-stone-gray">
                    {groupOrderContext.hostUserEmail}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-oo-stone-gray">Group participants</dt>
              <dd className="text-oo-charcoal sm:mt-0.5">
                {groupOrderContext.activeParticipantCount} active
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-oo-stone-gray">Group status</dt>
              <dd className="text-oo-charcoal sm:mt-0.5">
                {formatAdminGroupOrderStatus(groupOrderContext.status)}
              </dd>
            </div>
          </>
        ) : null}
        {adminOrder.orderNotes ? (
          <div className="sm:col-span-2">
            <dt className="text-oo-stone-gray">Checkout notes</dt>
            <dd className="mt-0.5 text-oo-charcoal">{adminOrder.orderNotes}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/** @deprecated Use AdminOrderBasicsCard */
export const AdminOrderSummaryCard = AdminOrderBasicsCard;
