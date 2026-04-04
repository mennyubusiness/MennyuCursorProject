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
import { AdminDeliverectRecheck } from "./AdminDeliverectRecheck";
import { AdminDeliverectDiagnosticsPanel } from "./AdminDeliverectDiagnosticsPanel";
import { getDeliverectAdminCompactBadges } from "@/lib/deliverect-admin-lifecycle";

function isDeliverectRecheckEligible(vo: AdminOrderDetail["vendorOrders"][number]): boolean {
  const ch = vo.deliverectChannelLinkId ?? vo.vendor.deliverectChannelLinkId;
  if (ch == null || String(ch).trim() === "") return false;
  if (vo.routingStatus !== "sent") return false;
  if (vo.fulfillmentStatus !== "pending") return false;
  if (vo.lastExternalStatusAt != null) return false;
  if (vo.manuallyRecoveredAt != null) return false;
  return true;
}

function fulfillmentLabel(fulfillmentStatus: string): string {
  switch (fulfillmentStatus) {
    case "pending":
      return "Awaiting acceptance";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready for pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return fulfillmentStatus;
  }
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

  const timeline = buildAdminOrderTimeline(adminOrder);

  const vendorContexts = adminOrder.vendorOrders.map((vo) => {
    const deliverectBadges = getDeliverectAdminCompactBadges({
      routingStatus: vo.routingStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      deliverectOrderId: vo.deliverectOrderId,
      lastDeliverectResponse: vo.lastDeliverectResponse,
      lastExternalStatusAt: vo.lastExternalStatusAt,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
      createdAt: vo.createdAt,
      manuallyRecoveredAt: vo.manuallyRecoveredAt,
      statusAuthority: vo.statusAuthority,
      lastStatusSource: vo.lastStatusSource,
      deliverectAutoRecheckAttemptedAt: vo.deliverectAutoRecheckAttemptedAt,
      deliverectAutoRecheckResult: vo.deliverectAutoRecheckResult,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
    });
    const exceptionType = getExceptionType(vo);
    const actionState = getAdminActionState(vo, routingAvailable);
    const reason = exceptionType ? getExceptionReason(vo, exceptionType) : null;
    const showRecoveredBadge = isManuallyRecovered(vo, vo.statusHistory);
    const showActionsPanel =
      actionState.hasAnyExceptionAction || actionState.hasAnyProgressionAction;
    const progressionTargetsFiltered =
      actionState.showCancel && actionState.allowedProgressionTargets.includes("cancelled")
        ? actionState.allowedProgressionTargets.filter((t) => t !== "cancelled")
        : actionState.allowedProgressionTargets;
    const showProgressionUi =
      actionState.hasAnyProgressionAction && progressionTargetsFiltered.length > 0;
    return {
      vo,
      deliverectBadges,
      exceptionType,
      actionState,
      reason,
      showRecoveredBadge,
      showActionsPanel,
      progressionTargetsFiltered,
      showProgressionUi,
    };
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
          Summary first, then actions — full routing codes are under Technical details.
        </p>
      </div>

      {/* 1. Summary */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Summary</h2>
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

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">Vendors</h3>
        <ul className="mt-2 divide-y divide-stone-100">
          {vendorContexts.map(({ vo, deliverectBadges, exceptionType, showRecoveredBadge }) => (
            <li key={vo.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 first:pt-0">
              <span className="font-medium text-stone-900">{vo.vendor.name}</span>
              <span className="text-sm text-stone-600">{fulfillmentLabel(vo.fulfillmentStatus)}</span>
              {deliverectBadges.map((b, bi) => (
                <span
                  key={`${b.label}-${bi}`}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.className}`}
                >
                  {b.label}
                </span>
              ))}
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
          ))}
        </ul>

        <p className="mt-4 text-sm text-stone-600">
          <Link href={`/order/${orderId}`} className="hover:underline">
            Customer tracking page →
          </Link>
        </p>
      </section>

      {/* 2. Primary actions */}
      {vendorContexts.some((c) => c.showActionsPanel) && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Primary actions</h2>
          <p className="mt-1 text-sm text-stone-600">
            Per-vendor controls. Cancel appears once here (not again in the transition list).
          </p>
          <div className="mt-4 space-y-4">
            {vendorContexts
              .filter((c) => c.showActionsPanel)
              .map(({ vo, exceptionType, actionState, reason, showProgressionUi, progressionTargetsFiltered }) => (
                <div key={vo.id} className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-stone-900">{vo.vendor.name}</h3>
                    <Link
                      href={`/vendor/${vo.vendorId}/orders`}
                      className="text-xs text-stone-600 hover:underline"
                    >
                      Vendor queue →
                    </Link>
                  </div>
                  {exceptionType && reason && <p className="mt-2 text-sm text-amber-900">{reason}</p>}
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
                  {showProgressionUi && (
                    <div className="mt-3">
                      <AdminVendorOrderTransition
                        vendorOrderId={vo.id}
                        allowedTargets={progressionTargetsFiltered}
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 3. Issues & notes */}
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

      {/* 4. Vendor order slices */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-900">Vendor orders</h2>
        <p className="mt-1 text-sm text-stone-500">Line items and refund status per vendor slice.</p>
        <div className="mt-4 space-y-6">
          {vendorContexts.map(({ vo }) => {
            const voRefunds = adminOrder.refundAttempts.filter((ra) => ra.vendorOrderId === vo.id);
            const latestRefund = voRefunds.length > 0 ? voRefunds[voRefunds.length - 1] : null;
            const amount = latestRefund ? `$${(latestRefund.amountCents / 100).toFixed(2)}` : "";

            return (
              <div key={vo.id} className="border-t border-stone-100 pt-4 first:border-t-0 first:pt-0">
                <p className="font-medium text-stone-800">{vo.vendor.name}</p>
                <AdminDeliverectDiagnosticsPanel vo={vo} />
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
                        This vendor order was cancelled. Refund or reconciliation may be needed outside Mennyu.
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

      {/* 4b. Deliverect reconciliation fallback */}
      {vendorContexts.some((c) => isDeliverectRecheckEligible(c.vo)) && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Deliverect reconciliation</h2>
          <p className="mt-1 text-sm text-stone-600">
            If webhooks are delayed, re-fetch order status from Deliverect (GET by stored external id). Webhooks remain
            the primary path.
          </p>
          <div className="mt-4 space-y-4">
            {vendorContexts
              .filter((c) => isDeliverectRecheckEligible(c.vo))
              .map(({ vo }) => (
                <div key={vo.id} className="rounded-lg border border-stone-100 bg-stone-50/50 p-3">
                  <p className="text-sm font-medium text-stone-900">{vo.vendor.name}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Channel order id (sent to Deliverect) = vendor order id <span className="font-mono">{vo.id}</span>
                  </p>
                  <AdminDeliverectRecheck vendorOrderId={vo.id} onlyIfOverdueDefault={false} />
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 5. Timeline (collapsed) */}
      {timeline.length > 0 && (
        <details className="rounded-lg border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-lg font-semibold text-stone-900">
            Order timeline
          </summary>
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
        </details>
      )}

      {/* 6. Debug (collapsed) */}
      <details className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-700">Technical details</summary>
        <div className="mt-3 space-y-3 font-mono text-xs text-stone-700">
          <p>
            <span className="text-stone-500">Order ID:</span> {adminOrder.id}
          </p>
          {vendorContexts.map(({ vo }) => (
            <p key={vo.id}>
              <span className="text-stone-500">Vendor order {vo.vendor.name}:</span> {vo.id} · routing{" "}
              {vo.routingStatus} · {vo.fulfillmentStatus}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
