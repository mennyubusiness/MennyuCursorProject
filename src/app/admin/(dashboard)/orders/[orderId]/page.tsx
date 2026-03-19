import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import {
  fetchAdminOrderDetail,
  type AdminOrderDetail,
} from "@/lib/admin-order-detail-query";
import { adminOperationalParentStatusLabel } from "@/domain/order-state";
import { getExceptionType, getExceptionReason } from "@/lib/admin-exceptions";
import { getAdminActionState } from "@/lib/admin-actions";
import { getVendorOrderHistoryEventLabel } from "@/lib/admin-history-labels";
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { AdminVendorOrderExceptionActions } from "./AdminVendorOrderExceptionActions";
import { AdminVendorOrderTransition } from "./AdminVendorOrderTransition";
import { AdminDeliverectSimulateStatus } from "./AdminDeliverectSimulateStatus";
import { AdminOrderIssuesSection } from "./AdminOrderIssuesSection";

/** TEMP: show Deliverect POS sim UI in dev, staging/sandbox, or when explicitly enabled. */
function showDeliverectStatusSimUI(): boolean {
  if (env.SHOW_DELIVERECT_STATUS_SIM_UI === "true") return true;
  if (env.NODE_ENV === "development") return true;
  const d = env.DELIVERECT_ENV?.trim().toLowerCase();
  if (d === "staging" || d === "sandbox") return true;
  return false;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const loaded = await fetchAdminOrderDetail(orderId);
  if (!loaded) notFound();
  const adminOrder: AdminOrderDetail = loaded;

  const routingAvailable = isRoutingRetryAvailable();

  function formatDate(d: Date) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
  }

  function refundTimelineLabel(
    ra: { amountCents: number; status: string; vendorOrderId: string | null; failureMessage: string | null; failureCode: string | null; stripeRefundId: string | null; dismissedAsLegacyAt: Date | null; dismissedAsLegacyBy: string | null },
    vendorNameForVo: (vendorOrderId: string) => string | null
  ): string {
    const amount = `$${(ra.amountCents / 100).toFixed(2)}`;
    const vendorSuffix = ra.vendorOrderId ? ` (${vendorNameForVo(ra.vendorOrderId) ?? "vendor order"})` : "";
    const dismissedSuffix = ra.dismissedAsLegacyAt != null ? " (dismissed as legacy)" : "";
    if (ra.status === "succeeded") {
      const stripe = ra.stripeRefundId ? ` — ${ra.stripeRefundId}` : "";
      return `Refund completed — ${amount}${vendorSuffix}${stripe}${dismissedSuffix}`;
    }
    if (ra.status === "failed") {
      const msg = ra.failureMessage
        ? ` — ${ra.failureMessage.slice(0, 60)}${ra.failureMessage.length > 60 ? "…" : ""}`
        : ra.failureCode
          ? ` — ${ra.failureCode}`
          : "";
      return `Refund failed — ${amount}${vendorSuffix}${msg}${dismissedSuffix}`;
    }
    return `Refund attempted — ${amount}${vendorSuffix}${dismissedSuffix}`;
  }

  const hasHistory =
    adminOrder.statusHistory.length > 0 ||
    adminOrder.issues.length > 0 ||
    adminOrder.vendorOrders.some((vo) => vo.issues.length > 0) ||
    adminOrder.refundAttempts.length > 0;

  const vendorNameByVoId = (vendorOrderId: string) =>
    adminOrder.vendorOrders.find((vo) => vo.id === vendorOrderId)?.vendor.name ?? null;

  const timelineEntries = [
    ...adminOrder.statusHistory.map((h) => ({
      date: h.createdAt.getTime(),
      key: `status-${h.id}`,
      label: `${h.status}${h.source ? ` (${h.source})` : ""}`,
    })),
    ...adminOrder.issues.flatMap((i) => [
      { date: i.createdAt.getTime(), key: `oi-created-${i.id}`, label: `Order issue: ${i.type.replace(/_/g, " ")} (${i.status})` },
      ...(i.resolvedAt ? [{ date: i.resolvedAt.getTime(), key: `oi-resolved-${i.id}`, label: `Order issue resolved: ${i.type.replace(/_/g, " ")}` }] : []),
    ]),
    ...adminOrder.vendorOrders.flatMap((vo) =>
      vo.issues.flatMap((i) => [
        { date: i.createdAt.getTime(), key: `voi-created-${i.id}`, label: `Vendor issue (${vo.vendor.name}): ${i.type.replace(/_/g, " ")} (${i.status})` },
        ...(i.resolvedAt ? [{ date: i.resolvedAt.getTime(), key: `voi-resolved-${i.id}`, label: `Vendor issue resolved (${vo.vendor.name}): ${i.type.replace(/_/g, " ")}` }] : []),
      ])
    ),
    ...adminOrder.refundAttempts.map((ra) => ({
      date: ra.createdAt.getTime(),
      key: `refund-${ra.id}`,
      label: refundTimelineLabel(ra, vendorNameByVoId),
    })),
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/orders" className="text-sm text-stone-600 hover:underline">
          ← Orders
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">
          Order #{adminOrder.id.slice(-8).toUpperCase()}
        </h1>
        <p className="mt-0.5 text-sm text-stone-600">
          Inspect and manage order state across vendors. Use exception actions to resolve failures, or continue fulfillment.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Order</h2>
        <dl className="mt-2 grid gap-1 text-sm">
          <div>
            <span className="text-stone-500">Created:</span> {formatDate(adminOrder.createdAt)}
          </div>
          <div>
            <span className="text-stone-500">Status:</span>{" "}
            {adminOperationalParentStatusLabel(
              adminOrder.status as Parameters<typeof adminOperationalParentStatusLabel>[0],
              adminOrder.vendorOrders
            )}
          </div>
          <div>
            <span className="text-stone-500">Customer phone:</span> {adminOrder.customerPhone}
          </div>
          {adminOrder.customerEmail && (
            <div>
              <span className="text-stone-500">Customer email:</span> {adminOrder.customerEmail}
            </div>
          )}
          <div>
            <span className="text-stone-500">Pod:</span> {adminOrder.pod.name}
          </div>
          {adminOrder.orderNotes && (
            <div>
              <span className="text-stone-500">Order notes:</span> {adminOrder.orderNotes}
            </div>
          )}
          <div>
            <span className="text-stone-500">Subtotal:</span> ${(adminOrder.subtotalCents / 100).toFixed(2)}
          </div>
          <div>
            <span className="text-stone-500">Total:</span> ${(adminOrder.totalCents / 100).toFixed(2)}
          </div>
        </dl>
      </section>

      {hasHistory && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-medium text-stone-900">Order status history</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {timelineEntries.map((e) => (
              <li key={e.key}>
                {formatDate(new Date(e.date))} — {e.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminOrderIssuesSection
        orderIssues={adminOrder.issues.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          status: i.status,
          notes: i.notes,
          createdAt: i.createdAt.toISOString(),
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
        }))}
        vendorOrderIssues={adminOrder.vendorOrders.flatMap((vo) =>
          vo.issues.map((i) => ({
            id: i.id,
            vendorOrderId: vo.id,
            vendorName: vo.vendor.name,
            type: i.type,
            severity: i.severity,
            status: i.status,
            notes: i.notes,
            createdAt: i.createdAt.toISOString(),
            resolvedAt: i.resolvedAt?.toISOString() ?? null,
          }))
        )}
      />

      <section className="space-y-4">
        <h2 className="font-medium text-stone-900">Vendor orders</h2>
        {adminOrder.vendorOrders.map((vo) => {
          const exceptionType = getExceptionType(vo);
          const actionState = getAdminActionState(vo, routingAvailable);
          const reason = exceptionType ? getExceptionReason(vo, exceptionType) : null;
          const showRecoveredBadge = isManuallyRecovered(vo, vo.statusHistory);
          return (
            <div
              key={vo.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <section>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Current state
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">{vo.vendor.name}</span>
                  <span className="text-sm text-stone-600">
                    Routing: {vo.routingStatus} · Fulfillment: {vo.fulfillmentStatus}
                  </span>
                  {exceptionType && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {exceptionType.replace("_", " ")}
                    </span>
                  )}
                  {showRecoveredBadge && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                      Recovered manually
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-stone-600">
                  Total: ${(vo.totalCents / 100).toFixed(2)}
                </p>
                <Link
                  href={`/vendor/${vo.vendorId}/orders`}
                  className="mt-1 inline-block text-sm text-stone-600 hover:underline"
                >
                  Vendor orders →
                </Link>
              </section>

              {exceptionType && (
                <section className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Why it needs attention
                  </p>
                  <p className="mt-1 text-sm text-amber-800">{reason}</p>
                  {(vo.deliverectAttempts != null && vo.deliverectAttempts > 0) ||
                  vo.deliverectSubmittedAt != null ||
                  (vo.deliverectLastError != null && vo.deliverectLastError !== "") ? (
                    <p className="mt-0.5 text-xs text-stone-500">
                      Attempts: {vo.deliverectAttempts ?? 0}
                      {vo.deliverectSubmittedAt != null &&
                        ` · Last attempt: ${formatDate(vo.deliverectSubmittedAt)}`}
                      {vo.deliverectLastError != null && vo.deliverectLastError !== "" && (
                        <span className="block text-amber-800">Last error: {vo.deliverectLastError}</span>
                      )}
                    </p>
                  ) : null}
                </section>
              )}

              <section className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Needs attention actions
                </p>
                {actionState.hasAnyExceptionAction ? (
                  <div className="mt-1">
                    <AdminVendorOrderExceptionActions
                      vendorOrderId={vo.id}
                      exceptionType={
                        exceptionType ??
                        (actionState.context === "manually_recovered" ? "routing_failed" : "unknown_attention_needed")
                      }
                      fulfillmentStatus={vo.fulfillmentStatus}
                      routingAvailable={routingAvailable}
                      canCancel={actionState.showCancel}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No needs-attention actions available</p>
                )}
              </section>

              <section className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Order progression
                </p>
                {actionState.hasAnyProgressionAction ? (
                  <div className="mt-1">
                    <AdminVendorOrderTransition
                      vendorOrderId={vo.id}
                      currentRouting={vo.routingStatus}
                      currentFulfillment={vo.fulfillmentStatus}
                      allowedTargets={actionState.allowedProgressionTargets}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No valid progression actions (terminal state or use exception actions above)</p>
                )}
              </section>

              {showDeliverectStatusSimUI() && vo.deliverectOrderId != null && vo.deliverectOrderId !== "" && (
                <section className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Deliverect sandbox
                  </p>
                  <AdminDeliverectSimulateStatus vendorOrderId={vo.id} />
                </section>
              )}

              <section className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  History / audit
                </p>
                {vo.statusHistory.length > 0 ? (
                  <ul className="mt-1 space-y-1.5 text-sm">
                    {vo.statusHistory.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-stone-500">{formatDate(h.createdAt)}</span>
                        <span className="font-medium text-stone-800">
                          {getVendorOrderHistoryEventLabel(h)}
                        </span>
                        {h.source && (
                          <span className="text-xs text-stone-400">({h.source})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No status history yet</p>
                )}
              </section>

              {vo.fulfillmentStatus === "cancelled" && (() => {
                const voRefunds = adminOrder.refundAttempts.filter((ra) => ra.vendorOrderId === vo.id);
                const latestRefund = voRefunds.length > 0 ? voRefunds[voRefunds.length - 1] : null;
                const amount = latestRefund ? `$${(latestRefund.amountCents / 100).toFixed(2)}` : "";
                if (latestRefund?.status === "succeeded") {
                  return (
                    <section className="mt-3 rounded border border-stone-200 bg-stone-50/80 p-2">
                      <p className="text-xs font-medium text-stone-800">Refund completed — {amount}</p>
                    </section>
                  );
                }
                if (latestRefund?.status === "attempted") {
                  return (
                    <section className="mt-3 rounded border border-stone-200 bg-stone-50/80 p-2">
                      <p className="text-xs font-medium text-stone-800">Refund pending — {amount}</p>
                    </section>
                  );
                }
                if (latestRefund?.status === "failed") {
                  return (
                    <section className="mt-3 rounded border border-amber-200 bg-amber-50/50 p-2">
                      <p className="text-xs font-medium text-amber-800">Refund failed — {amount}</p>
                      {latestRefund.failureMessage && (
                        <p className="mt-0.5 text-xs text-stone-600">{latestRefund.failureMessage.slice(0, 120)}{latestRefund.failureMessage.length > 120 ? "…" : ""}</p>
                      )}
                      <p className="mt-1 text-xs text-stone-500">Manual follow-up may be required (e.g. Stripe dashboard or support).</p>
                    </section>
                  );
                }
                return (
                  <section className="mt-3 rounded border border-amber-200 bg-amber-50/50 p-2">
                    <p className="text-xs font-medium text-amber-800">Financial follow-up may be required</p>
                    <p className="mt-0.5 text-xs text-stone-600">
                      This vendor order was cancelled. Refund or reconciliation may be needed — handle outside this dashboard.
                    </p>
                  </section>
                );
              })()}

              <div className="mt-4">
                <p className="text-sm font-medium text-stone-700">Line items</p>
                <ul className="mt-2 space-y-2">
                  {vo.lineItems.map((line) => (
                    <li key={line.id} className="border-b border-stone-100 pb-2 text-sm last:border-0">
                      <span className="font-medium">{line.name}</span> × {line.quantity}
                      {line.specialInstructions && (
                        <p className="text-amber-800">Note: {line.specialInstructions}</p>
                      )}
                      {line.selections.length > 0 && (
                        <p className="text-stone-500">
                          {line.selections
                            .map((s) => `${s.nameSnapshot}${s.quantity > 1 ? ` ×${s.quantity}` : ""}`)
                            .join(", ")}
                        </p>
                      )}
                      <span className="text-stone-500">
                        ${((line.priceCents * line.quantity) / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </section>

      <p className="text-sm text-stone-600">
        <Link href={`/order/${orderId}`} className="hover:underline">
          Customer tracking page →
        </Link>
      </p>
    </div>
  );
}
