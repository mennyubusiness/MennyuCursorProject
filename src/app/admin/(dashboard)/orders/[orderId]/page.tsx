import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAdminOrderDetail,
  type AdminOrderDetail,
} from "@/lib/admin-order-detail-query";
import { adminOperationalParentStatusLabel } from "@/domain/order-state";
import { getExceptionType, getExceptionReason } from "@/lib/admin-exceptions";
import { getAdminActionState } from "@/lib/admin-actions";
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { buildAdminOrderTimeline } from "@/lib/admin-order-timeline";
import { AdminVendorOrderExceptionActions } from "./AdminVendorOrderExceptionActions";
import { AdminVendorOrderTransition } from "./AdminVendorOrderTransition";
import { AdminOrderIssuesPanel } from "./AdminOrderIssuesPanel";

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

  const timeline = buildAdminOrderTimeline(adminOrder);

  const vendorContexts = adminOrder.vendorOrders.map((vo) => {
    const exceptionType = getExceptionType(vo);
    const actionState = getAdminActionState(vo, routingAvailable);
    const reason = exceptionType ? getExceptionReason(vo, exceptionType) : null;
    const showRecoveredBadge = isManuallyRecovered(vo, vo.statusHistory);
    const showActionsPanel =
      actionState.hasAnyExceptionAction || actionState.hasAnyProgressionAction;
    return { vo, exceptionType, actionState, reason, showRecoveredBadge, showActionsPanel };
  });

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
          Action-first view: what&apos;s wrong, what to do, and a single timeline.
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
              <span className="text-stone-500">Checkout notes:</span> {adminOrder.orderNotes}
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

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Current state</h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {vendorContexts.map(
            ({ vo, exceptionType, showRecoveredBadge }) =>
              (
                <li key={vo.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 first:pt-0">
                  <span className="font-medium text-stone-900">{vo.vendor.name}</span>
                  <span className="text-sm text-stone-600">
                    Routing {vo.routingStatus} · {vo.fulfillmentStatus}
                  </span>
                  {exceptionType && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {exceptionType.replace(/_/g, " ")}
                    </span>
                  )}
                  {showRecoveredBadge && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                      Recovered manually
                    </span>
                  )}
                  <span className="text-xs text-stone-500">${(vo.totalCents / 100).toFixed(2)}</span>
                </li>
              )
          )}
        </ul>
      </section>

      <AdminOrderIssuesPanel
        orderId={adminOrder.id}
        initialResolutionNotes={adminOrder.adminResolutionNotes ?? null}
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

      {vendorContexts.some((c) => c.showActionsPanel) && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Actions</h2>
          <p className="mt-1 text-sm text-stone-600">
            Per-vendor operations. Only options valid for the current state are shown.
          </p>
          <div className="mt-4 space-y-4">
            {vendorContexts
              .filter((c) => c.showActionsPanel)
              .map(({ vo, exceptionType, actionState, reason }) => (
                <div
                  key={vo.id}
                  className="rounded-lg border border-stone-200 bg-stone-50/50 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-stone-900">{vo.vendor.name}</h3>
                    <Link
                      href={`/vendor/${vo.vendorId}/orders`}
                      className="text-xs text-stone-600 hover:underline"
                    >
                      Vendor orders →
                    </Link>
                  </div>
                  {exceptionType && reason && (
                    <p className="mt-2 text-sm text-amber-900">{reason}</p>
                  )}
                  {actionState.hasAnyExceptionAction && (
                    <div className="mt-3">
                      <AdminVendorOrderExceptionActions
                        vendorOrderId={vo.id}
                        exceptionType={
                          exceptionType ??
                          (actionState.context === "manually_recovered"
                            ? "routing_failed"
                            : "unknown_attention_needed")
                        }
                        fulfillmentStatus={vo.fulfillmentStatus}
                        routingAvailable={routingAvailable}
                        canCancel={actionState.showCancel}
                      />
                    </div>
                  )}
                  {actionState.hasAnyProgressionAction && actionState.allowedProgressionTargets.length > 0 && (
                    <div className="mt-3">
                      <AdminVendorOrderTransition
                        vendorOrderId={vo.id}
                        currentRouting={vo.routingStatus}
                        currentFulfillment={vo.fulfillmentStatus}
                        allowedTargets={actionState.allowedProgressionTargets}
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Order timeline</h2>
          <p className="mt-1 text-sm text-stone-500">
            Chronological history — parent order, vendors, issues, and refunds.
          </p>
          <ul className="mt-4 space-y-3">
            {timeline.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-0.5 border-b border-stone-100 pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3"
              >
                <span className="shrink-0 text-xs text-stone-500">{formatDate(e.at)}</span>
                <span className="font-medium text-stone-900">{e.title}</span>
                <span className="text-xs text-stone-500">{e.sourceLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-900">Line items</h2>
        <div className="mt-4 space-y-6">
          {vendorContexts.map(({ vo }) => {
            const voRefunds = adminOrder.refundAttempts.filter((ra) => ra.vendorOrderId === vo.id);
            const latestRefund = voRefunds.length > 0 ? voRefunds[voRefunds.length - 1] : null;
            const amount = latestRefund ? `$${(latestRefund.amountCents / 100).toFixed(2)}` : "";

            return (
              <div key={vo.id} className="border-t border-stone-100 pt-4 first:border-t-0 first:pt-0">
                <p className="font-medium text-stone-800">{vo.vendor.name}</p>
                {vo.fulfillmentStatus === "cancelled" && (() => {
                  if (latestRefund?.status === "succeeded") {
                    return (
                      <p className="mt-2 rounded border border-stone-200 bg-stone-50/80 p-2 text-xs font-medium text-stone-800">
                        Refund completed — {amount}
                      </p>
                    );
                  }
                  if (latestRefund?.status === "attempted") {
                    return (
                      <p className="mt-2 rounded border border-stone-200 bg-stone-50/80 p-2 text-xs font-medium text-stone-800">
                        Refund pending — {amount}
                      </p>
                    );
                  }
                  if (latestRefund?.status === "failed") {
                    return (
                      <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2">
                        <p className="text-xs font-medium text-amber-800">Refund failed — {amount}</p>
                        {latestRefund.failureMessage && (
                          <p className="mt-0.5 text-xs text-stone-600">
                            {latestRefund.failureMessage.slice(0, 120)}
                            {latestRefund.failureMessage.length > 120 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2">
                      <p className="text-xs font-medium text-amber-800">Financial follow-up may be required</p>
                      <p className="mt-0.5 text-xs text-stone-600">
                        This vendor order was cancelled. Refund or reconciliation may be needed outside this
                        dashboard.
                      </p>
                    </div>
                  );
                })()}
                <ul className="mt-3 space-y-2">
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
            );
          })}
        </div>
      </section>

      <p className="text-sm text-stone-600">
        <Link href={`/order/${orderId}`} className="hover:underline">
          Customer tracking page →
        </Link>
      </p>
    </div>
  );
}
